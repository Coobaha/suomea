#!/usr/bin/env bash
pyclean ./plugin

7za a AnkiFinnish.zip -bso0 -x!meta.json -x!.mypy_cache ./plugin/*
7za l AnkiFinnish.zip
