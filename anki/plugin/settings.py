import importlib
from dataclasses import dataclass, asdict
from json import dumps
from urllib.parse import urlparse

from PyQt6.QtWidgets import QDialog, QLayout, QComboBox
from anki.httpclient import HttpClient
from aqt import mw, addons
from aqt.addons import AddonsDialog
from aqt.utils import showInfo, tooltip, showCritical

from .gui.settings_ui import Ui_Settings

assert mw is not None

config = mw.addonManager.getConfig(__name__) or {}

from typing import TypeVar, Optional

T = TypeVar("T")  # Declare type variable


def get(key: str, default: T) -> T:
    val = config.get(key)
    if val is not None:
        return val  # type: ignore
    return default


@dataclass
class Settings:
    note_type: Optional[str] = get("note_type", None)
    deck: Optional[str] = get("deck", None)
    notes_field: Optional[str] = get("notes_field", None)
    answer_field: Optional[str] = get("answer_field", None)
    question_field: Optional[str] = get("question_field", None)
    enabled: bool = get("enabled", False)
    ankiconnect: bool = get("ankiconnect", False)
    uri: str = get("uri", "https://suomea.xyz")

    def to_json(self) -> str:
        return dumps(asdict(self))

    def to_dict(self) -> dict[str, T]:
        return asdict(self)


settings = Settings()


def anki_connect_setup(parent=None) -> None:  # type: ignore
    assert mw is not None
    if settings.ankiconnect is None:
        return

    if settings.ankiconnect is False:
        add_new_handlers()
        return

    anki_connect_id = "2055492159"

    try:
        importlib.import_module(anki_connect_id)
    except:
        tooltip(
            "AnkiFinnish: Downloading AnkiConnect plugin [{}]".format(anki_connect_id),
            parent=parent,
        )

        (_, result) = addons.download_and_install_addon(
            mw.addonManager, HttpClient(), int(anki_connect_id)
        )
        if isinstance(result, addons.DownloadError):
            raise Exception("Anki Script download failed: {0}".format(result))

    anki_connect_cfg = mw.addonManager.getConfig(anki_connect_id)
    mw.addonManager.toggleEnabled(anki_connect_id, enable=True)
    url = urlparse(settings.uri)
    app_address = "{}://{}".format(url.scheme, url.hostname)
    if anki_connect_cfg:
        cors_list = anki_connect_cfg.get("webCorsOriginList", [])
        if app_address not in cors_list:
            tooltip(
                "AnkiFinnish: Adding {} to AnkiConnect CORS list".format(app_address),
                parent=parent,
            )
            cors_list.append(app_address)
            cors_list.append("https://cooba.me")
            cors_list = list(dict.fromkeys(cors_list))
            anki_connect_cfg["webCorsOriginList"] = cors_list
            mw.addonManager.writeConfig(anki_connect_id, anki_connect_cfg)
    else:
        showInfo(
            "AnkiFinnish: Failed to add {} to AnkiConnect CORS list. "
            " AnkiConnect config is missing".format(settings.uri)
        )

    add_new_handlers()


def add_new_handlers() -> None:
    try:
        anki_connect_id = "2055492159"
        anki_connect = importlib.import_module(anki_connect_id)
        anki_connect_util = importlib.import_module("{}.util".format(anki_connect_id))

        @anki_connect_util.api()
        def handler(_):  # type: ignore
            return settings.to_dict()

        setattr(anki_connect.AnkiConnect, "coobame_settings", handler)
    except:
        showInfo(
            "AnkiFinnish: Failed to add api method to AnkiConnect.\n"
            "AnkiConnect probably is not installed. Enable auto configuration of AnkiConnect in "
            "AnkiFinnish settings or install AnkiConnect manually and configure CORS settings"
        )
        pass


# extends Qdialog
class SettingsModal(QDialog):
    def __init__(self, parent: Optional[AddonsDialog] = None):
        super().__init__(parent=parent)

        assert mw is not None
        assert mw is not None
        self._parent = parent
        self.did_add_models = False
        self.ui = Ui_Settings()
        self.ui.setupUi(self)  # type: ignore
        layout = self.layout()
        if layout is not None:
            layout.setSizeConstraint(QLayout.SizeConstraint.SetFixedSize)

        all_decks = [str(x["name"]) for x in mw.col.decks.all()]

        if settings.deck is None:
            settings.deck = all_decks[0]

        self.setup_note_type_dependant_fields(settings.note_type)
        self.ui.defaultDeck.addItems(sorted(all_decks))
        self.ui.defaultDeck.setCurrentText(settings.deck)
        self.yesno(self.ui.ankiConnect, settings.ankiconnect)
        self.yesno(self.ui.enabled, settings.enabled)

        self.ui.appUri.setText(settings.uri)

        self.ui.buttonBox.accepted.connect(self.save)
        self.ui.buttonBox.rejected.connect(self.reject)

        self.ui.noteType.currentTextChanged.connect(
            self.setup_note_type_dependant_fields
        )

        self.exec()

    @staticmethod
    def yesno(dropdown: QComboBox, val: bool) -> None:
        if val is True:
            dropdown.setCurrentText("Yes")
        else:
            dropdown.setCurrentText("No")

    def setup_note_type_dependant_fields(self, nt_name: Optional[str]) -> None:
        assert mw is not None
        all_models = [n.name for n in mw.col.models.all_names_and_ids()]

        if nt_name is None:
            nt_name = all_models[0]

        note_type = mw.col.models.by_name(nt_name)

        if note_type is None:
            return

        all_fields = mw.col.models.field_names(note_type)
        self.ui.questionField.clear()
        self.ui.answerField.clear()
        self.ui.notesField.clear()

        if not self.did_add_models:
            self.did_add_models = True
            self.ui.noteType.addItems(all_models)

        self.ui.questionField.addItems(all_fields)
        self.ui.answerField.addItems(["", *all_fields])
        self.ui.notesField.addItems(["", *all_fields])

        self.ui.noteType.setCurrentText(note_type["name"])

        if settings.question_field in all_fields:
            self.ui.questionField.setCurrentText(settings.question_field)
        else:
            self.ui.questionField.setCurrentText(all_fields[0])

        if settings.answer_field in all_fields:
            self.ui.answerField.setCurrentText(settings.answer_field)
        else:
            self.ui.answerField.setCurrentText("")

        if settings.notes_field in all_fields:
            self.ui.notesField.setCurrentText(settings.notes_field)
        else:
            self.ui.notesField.setCurrentText("")

    def validate(self) -> bool:
        all_fields = list(
            filter(
                lambda x: x != "",
                [
                    self.ui.noteType.currentText,
                    self.ui.answerField.currentText(),
                    self.ui.notesField.currentText(),
                ],
            )
        )

        uniq = list(dict.fromkeys(all_fields))
        valid = len(uniq) == len(all_fields)

        if valid is False:
            showCritical(
                "Question field / Answer field / Notes field should be unique",
                parent=self._parent,
            )

        return valid

    def save(self) -> None:
        if self.validate():
            settings.enabled = self.ui.enabled.currentText() == "Yes"
            settings.ankiconnect = self.ui.ankiConnect.currentText() == "Yes"
            settings.uri = self.ui.appUri.text().rstrip("/")
            settings.note_type = self.ui.noteType.currentText()
            settings.answer_field = self.ui.answerField.currentText()
            settings.notes_field = self.ui.notesField.currentText()
            settings.deck = self.ui.defaultDeck.currentText()
            settings.question_field = self.ui.questionField.currentText()

            assert mw
            mw.addonManager.writeConfig(__name__, settings.to_dict())
            anki_connect_setup(parent=self._parent)
            self.accept()
