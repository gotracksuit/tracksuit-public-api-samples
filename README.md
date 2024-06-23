# Public API Sample

Sample Javascript code to download all data that you have access to via the
Tracksuit public API. Requries a valid JWT issued by Tracksuit.

## Setup

This project should be installable with any recent version of the NodeJS
toolchain.

```sh
npm install
```

This repository contains a Nix Flake that will install a pinned version of Node
& PNPM, should you wish to use that instead.

```
nix develop
pnpm install
```

## Usage

Running the script will output funnel data into `./results`.

```sh
export TRACKSUIT_API_TOKEN=<YOUR API KEY>
./download-all-funnel-data.js
```
