/**
 * Any logging message that should be used as a transfer message from a webview.
 *
 * You need to transfer the messages out of the webview, in order to log them into the output channel and possible any information/warn/error message.
 */
export interface LoggingMessageWithLevel extends LoggingMessage {
  /**
   * The level where the message should be logged.
   */
  level: "error" | "warn" | "info" | "debug";
}

/**
 * The logging message that should be logged.
 */
export interface LoggingMessage {
  /**
   * The message itself.
   *
   * If you have an try-catch, please add the error of this catch separately to the `error` attribute.
   */
  message: string;

  /**
   * If you want the user to notify as well. These will show the corresponding `showInformationMessage` / `showWarnMessage` / `showErrorMessage` dialogs.
   *
   * The user can not be notified, if the level is `debug`.
   */
  notifyUser?: boolean;

  /*
   * Any optional error from any catch block. These errors will only be logged, if you have the log level to `error`.
   *
   * If the error includes a stack attribute (which the exception does), then the error will be logged.
   * If there is no stack attribute in the error, then nothing will be logged.
   */
  error?: unknown;
}
