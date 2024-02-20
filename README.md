# vscode-logging

This is used to add a simple and easy to use logging to any VS Code extension.

The key idea is that you do not need to call `vscode.window.showInformationMessage` (or similar methods) and do not need to write any additional logs, because this module will take care of everything.

Uncaught exceptions and uncaught rejects are logged as well.

## Installation

This module is published at [GitLab](https://gitlab.adito.de/plattform/designer/vscode-logging/-/packages) and [Nexus](https://nexus.adito.cloud/#browse/browse:xrm). Please check the corresponding sites on how to add the npm repository to your project.

After you have added the repository to your project, you can install it normally.

```shell
npm i @aditosoftware/vscode-logging
```

## Usage

### Initialization of the Logger

The logger needs to be initialized once in your `activate` method. The name given will be used for the [main logging file](#normal-log-file-namelog).

```typescript
export function activate(context: vscode.ExtensionContext) {
  Logger.initializeLogger(context, "MyExtensionName");
}
```

After you have initialized the logger, you can get an instance and log.

### Logging

After the [initialization](#initialization-of-the-logger), you can get any logger instance via `Logger.getLogger()`. On this instance, you can call any log methods.

#### How to log

##### Basic logging

The logger can log to four different levels:

- debug
- info
- warn
- error

All four levels are written to the logging file, and all levels except debug are written [the output channel](#output-channel) and can [notify the user](#notify-the-user).

A normal minimal logging call can look like this:

```typescript
import { Logger } from "@aditosoftware/vscode-logging";

const logger: Logger = Logger.getLogger();

logger.debug({ message: "my debug message" });
logger.info({ message: "my info message" });
logger.warn({ message: "my warn message" });
logger.error({ message: "my error message" });
```

##### Logging from a webview

You can not call any logging methods from the webview directly. Instead, you need to transfer the log data to your extension and log it there. This minimal example assumes you know how to [transfer data from a webview to an extension](https://code.visualstudio.com/api/extension-guides/webview#passing-messages-from-a-webview-to-an-extension). Please be aware that transferring data can look a bit different from use case to use case.

For this use case, you can use `LoggingMessageWithLevel` to pass the data from the webview to the extension.

In your webview, you could transfer the message as following:

```typescript
// Build the logging message
const data: LoggingMessageWithLevel = {
  // you need to give the level which yor message should have
  level: "info",
  message: "my message from webview",
};

// and post it to your extension
vscodeApiWrapper.postMessage(data);
```

All other parameters from `LoggingMessage` are also valid.

Then you could receive the message in your extension and log via the `log` method.

```typescript
private _setWebviewMessageListener(webview: Webview) {
  webview.onDidReceiveMessage(
    (message: unknown) => {

      // receive the data
      const data: LoggingMessageWithLevel = message as LoggingMessageWithLevel;

      // and log it
      Logger.getLogger().log(data);
    });
}
```

#### Logging options

##### Notify the user

If you want to notify the user about your message as well, you need to set the `notifyUser` flag.
If this flag is set to `true`, then the message will show as:

- information message when logging to level info
- warning message when logging to level warn
- error message when logging to level error

Note: It will not show any message to the user, if your level is debug.

If you don't set this option, then the user will not be notified.

```typescript
logger.info({ message: "my info message", notifyUser: true });
```

##### Add stack traces to the log

Messages that are logged on error level, can log a stack trace as well.

The `stack` information from the `error` will be logged. These information will only show in the log files and output channel and never in any notification to the user.

```typescript
import { Logger } from "@aditosoftware/vscode-logging";

try {
  // any operation that can cause error
} catch (error) {
  Logger.getLogger().error({
    message: "error while trying to do XXX",
    error: error,
  });
}
```

## Logging locations

The logger can write to various locations. These are all active by default.

### Output channel

Every logging message of the levels info, warn and error are logged to the output channel.

If you want to open the output channel of the logs, you can use `logger.showOutputChannel`.

This can be used, if you have many information logs that were written during a command execution and at the end you have an error, which the user should be able to inspect.

```typescript
import { Logger } from "@aditosoftware/vscode-logging";

const logger: Logger = Logger.getLogger();

// a log of information that was logged to info (and not notify the user)

logger.warn({ message: "execution of the command was not successful", notifyUser: true });
logger.showOutputChannel();
```

### Console

If the variable `process.env.NODE_ENV` is not set to `production`, then any message logged to the files will be also logged to the console .

### The log files

After installing the extension, you can execute the command `workbench.action.openExtensionLogsFolder` to open the log folder for all extensions. Navigate in the folder of your extension.
The folders above your extensions folder and the deletion of old log folders are handled by VS Code.

Inside of this folder are two files: `error.log` and `<Name>.log`.

#### normal log file (`<Name>.log`)

This file's name is dependent on the given name during the initialization of the logger.

This file is the main log file. It has all logs from all levels (debug, info, warn and error).

#### error log file (`error.log`)

This fil only logs messages from the error level.

Additionally, it logs uncaught exceptions and uncaught rejections. Therefore, this log file should be used, if you are trying to find any errors and assume that there might be any uncaught errors.

## Contribution Notes

The underlying logging framework is [winston](https://github.com/winstonjs/winston), with [winston-transport](https://github.com/winstonjs/winston-transport) used for additional transport methods.
