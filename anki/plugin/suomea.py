import copy
from json import dumps
from typing import Optional
from urllib.parse import urlparse

from aqt import mw, gui_hooks
from aqt.addons import AddonsDialog
from aqt.browser.previewer import Previewer
from aqt.clayout import CardLayout
from aqt.hooks_gen import addons_dialog_will_show
from anki.cards import Card
from aqt.reviewer import Reviewer
from aqt.webview import WebContent

from .settings import settings, SettingsModal, anki_connect_setup

def prepare(html, card, context: str):
    if settings.enabled is False:
        return html
    if card.note_type()['name'] != settings.note_type:
        return html
    if mw is None:
        return html

    sched = copy.copy(mw.col.sched)

    for attr, value in vars(sched).items():
        try:
            setattr(sched, attr, copy.deepcopy(value))
        except Exception:
            pass

    next_card = None

    if sched.version == 3:
        cards = sched.get_queued_cards(fetch_limit=2)
        queued_card = cards.cards[1]

        if queued_card is not None:
            next_card = Card(sched.col)
            next_card._load_from_backend_card(queued_card.card)
            next_card.load()
    else:
        next_card = sched.getCard()

    if next_card is not None and settings.question_field is not None:
        try:
            next_term = next_card.note()[settings.question_field]  # type: Optional[str]
        except KeyError:
            next_term = next_card.note().values()[0]
    else:
        next_term = None

    next_id = None

    if next_card:
        next_id = next_card.note().id

    if context.startswith("clayout"):
        # in card layout preview we don't have current note, but we can use next_term
        current_term = "malli" if next_term is None else next_term
        current_id = next_id if next_id is not None else -1
    else:
        current_id = card.note().id

        try:
            current_term = card.note()[settings.question_field]
        except KeyError:
            current_term = card.note().values()[0]

    card_types = {
        0: "Forwards",
        1: "Reversed",
    }

    app_dict = {
        'context': context,
        'isAnki': True,

        'currentTerm': current_term,
        'cardType': card_types.get(card.ord, "Unknown"),
        'tags': card.note().tags,
        'id': current_id,

        'nextTerm': next_term,
        'nextId': next_id,
    }
    return f"""
<script>
window.myAnkiSetup = {dumps(app_dict)};
if (window.myAnkiUpdate) window.myAnkiUpdate(window.myAnkiSetup);
</script>""" + html


def add_html(web_content: WebContent):
    uri = settings.uri.rstrip("/")
    url = urlparse(uri)

    if url.scheme == 'https':
        ws = 'wss'
    else:
        ws = 'ws'

    hmr_url = '{0}://{1}'.format(ws, url.hostname)
    web_content.body = "<div id='myankitarget'></div>" + web_content.body
    web_content.head += "<style>" \
                        "html, body {padding: 0;margin: 0;} " \
                        "#myankitarget {position: fixed; top: 0;left:0; width: 100%; height: 100%;}" \
                        "</style>"

    if url.hostname:
        is_local = any(localhost in url.hostname for localhost in ['localhost', '127.0.0.1'])
    else:
        is_local = False

    if is_local:
        web_content.head += '''
        <script>window.HMR_WEBSOCKET_URL = "{hmr}";</script>
        <script type="module" src="{base}/dist/init.js"></script>
        '''.format(hmr=hmr_url, base=uri)
    else:
        web_content.head += '''
        <script src="{base}/js/webpack-runtime.js"></script>
        <script src="{base}/js/init.js"></script>
        '''.format(base=uri)


def on_webview_will_set_content(web_content: WebContent, context):
    if settings.enabled is False:
        return

    if isinstance(context, Reviewer):
        if context.card is not None and context.card.note_type()['name'] == settings.note_type:
            add_html(web_content=web_content)
    elif isinstance(context, Previewer):
        card = context.card()
        if card is not None and card.note_type()['name'] == settings.note_type:
            add_html(web_content=web_content)
    elif isinstance(context, CardLayout):
        if context.model is not None and context.model['name'] == settings.note_type:
            add_html(web_content=web_content)


gui_hooks.card_will_show.append(prepare)

gui_hooks.webview_will_set_content.append(on_webview_will_set_content)

addons_current: Optional[AddonsDialog] = None


def init():
    def save_addons_window(addons):
        global addons_current
        addons_current = addons

    def show_settings():
        SettingsModal(parent=addons_current)
        return True

    addons_dialog_will_show.append(save_addons_window)
    mw.addonManager.setConfigAction(__name__, show_settings)
    anki_connect_setup()


init()
