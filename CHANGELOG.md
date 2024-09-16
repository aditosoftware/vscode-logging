# Change Log

All notable changes to the "liquibase" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Upgraded dependencies:
  - winston to 3.14.2
  - winston-transport to 4.7.1
  - @types/mocha to 10.0.8
  - @vscode/test-cli to 0.0.10
  - @vscode/test-electron to 2.4.1
  - sinon to 19.0.2

## 1.0.2

### Added

- Added `ignoreFormatForOutputChannel` option to remove any timestamp and level information from the output to the VSCode output channel

## 1.0.1

### Added

- "Logger.getLogger().clear()" is now available to clear the output channel

## 1.0.0

### Added

- Basic logging for VS Code extensions and VS Code webviews
