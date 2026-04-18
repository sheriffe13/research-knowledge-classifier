# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Research Knowledge Classifier — a tool for classifying and organizing research knowledge. This is an early-stage project; update this file as the architecture is established.

## Stack

- **Framework**: Next.js 14 (App Router)
- **APIs**: Google Drive, Google Sheets (`googleapis`), Anthropic Claude (`@anthropic-ai/sdk`)
- **Purpose**: Extract paper metadata from Google Drive and sync to Google Sheets

## Setup

```bash
npm install
```

Copy `.env.local.example` to `.env.local` and fill in Google OAuth and Anthropic credentials.

## Commands

```bash
npm run dev    # start dev server
npm run build  # production build
npm run lint   # lint
```

## Architecture

API routes live under `app/api/`:
- `auth/start` — initiates Google OAuth flow
- `drive/scan` — scans Google Drive for research papers and extracts metadata via Claude
