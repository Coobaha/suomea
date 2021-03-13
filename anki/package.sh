#!/usr/bin/env bash
pyclean ./plugin
7za a CoobaMeFinnish.zip -bso0 -x!meta.json -x!.mypy_cache ./plugin/*
7za l CoobaMeFinnish.zip
