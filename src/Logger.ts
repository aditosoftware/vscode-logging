import * as vscode from "vscode";
import winston from "winston";
import TransportStream, { TransportStreamOptions } from "winston-transport";
import { LoggingMessage, LoggingMessageWithLevel } from ".";
import * as fs from "fs";

/**
 * A logger to log to the log file, output and window message.
 */
export class Logger {
  /**
   * The instance of the logger.
   */
  private static instance: Logger;

  /**
   * Creates a new instance of the logger. This should be only called inside this class, because you should only have one instance of this class.
   * @param logger - the logger that does all the logging
   * @param outputChannel - the output channel were all the messages should be written to
   */
  private constructor(private logger: winston.Logger, private outputChannel: vscode.OutputChannel) {
    this.logger = logger;
    this.outputChannel = outputChannel;
  }

  /**
   * Returns the singleton instance of the logger. Please note that you need to call `initializeLogger` once before getting the logger.
   * @returns - the logger of the extension.
   */
  static getLogger(): Logger {
    if (!this.instance) {
      throw new Error("no instance of the logger was created");
    }
    return this.instance;
  }

  /**
   * Reveal this channel in the UI.
   *
   * @param preserveFocus - When `true` the channel will not take focus.
   */
  showOutputChannel(preserveFocus?: boolean): void {
    this.outputChannel.show(preserveFocus);
  }

  /**
   * Logs any given message with the corresponding level.
   *
   * @param loggingMessage - the message tht should be logged
   */
  log(loggingMessage: LoggingMessageWithLevel): void {
    switch (loggingMessage.level) {
      case "error":
        this.error(loggingMessage);
        break;
      case "warn":
        this.warn(loggingMessage);
        break;
      case "info":
        this.info(loggingMessage);
        break;
      case "debug":
        this.debug(loggingMessage);
        break;
    }
  }

  /**
   * Logs an error message to the log file and the output.
   *
   * This method can notify any user via `vscode.window.showErrorMessage`.
   * Since a error could also have more details, you have in the errorMessage for the user the possibility to open the output.
   *
   * @param loggingMessage - the message that should be logged
   */
  error(loggingMessage: LoggingMessage): void {
    this.logger.error(loggingMessage.message, loggingMessage.error);
    if (loggingMessage.notifyUser) {
      vscode.window.showErrorMessage(loggingMessage.message, "Open output").then((dialogResult) => {
        if (dialogResult === "Open output") {
          this.showOutputChannel();
        }
      });
    }
  }

  /**
   * Logs a warn to the log file and the output.
   *
   * This method can notify any user via `vscode.window.showWarningMessage`.
   *
   * @param loggingMessage - the message that should be logged
   */
  warn(loggingMessage: LoggingMessage): void {
    this.logger.warn(loggingMessage.message);
    if (loggingMessage.notifyUser) {
      vscode.window.showWarningMessage(loggingMessage.message);
    }
  }

  /**
   * Logs an information message to the log file and the output.
   *
   * This method can notify any user via `vscode.window.showInformationMessage`.
   *
   * @param loggingMessage - the message that should be logged
   */
  info(loggingMessage: LoggingMessage): void {
    this.logger.info(loggingMessage.message);
    if (loggingMessage.notifyUser) {
      vscode.window.showInformationMessage(loggingMessage.message);
    }
  }

  /**
   * Logs an debug message to the output file.
   *
   * This message will never notify any user, it will be just written to the log.
   *
   * @param loggingMessage - the message that should be logged
   */
  debug(loggingMessage: LoggingMessage): void {
    this.logger.debug(loggingMessage.message);
  }

  /**
   * Initializes the logger. This needs to be done in the `activate` method of the extension.
   * @param context - the context where the logger needs to be registered.
   * @param name - the name of the extension. This will be also used as the name for the output channel as well as the name for the main file
   */
  static initializeLogger(context: vscode.ExtensionContext, name: string): void {
    // create output channel for any logging
    const outputChannel = vscode.window.createOutputChannel(name);
    context.subscriptions.push(outputChannel);

    // created the log folder, if it does not exist
    if (!fs.existsSync(context.logUri.fsPath)) {
      fs.mkdirSync(context.logUri.fsPath, { recursive: true });
    }

    // and create a logger
    const logger = winston.createLogger({
      level: "debug",
      exitOnError: false,
      format: winston.format.combine(
        winston.format.simple(),
        winston.format.metadata(),
        winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        // The format will add a stack, if this was given in the meta information. This will only happen in the error log.
        winston.format.printf(
          (info) => `${info.timestamp} [${info.level}] ${info.message}${info?.metadata?.stack || ""}`
        )
      ),
      transports: [
        // log everything to the output channel with info level or higher
        new VSCodeOutputChannelTransport(outputChannel, {
          level: "info",
        }),
        // log in in a file with the name of the extension and output channel everything
        new winston.transports.File({
          dirname: context.logUri.fsPath,
          filename: `${outputChannel.name}.log`,
        }),
        // separate file for every error log, including uncaught exceptions und rejections
        new winston.transports.File({
          level: "error",
          dirname: context.logUri.fsPath,
          filename: `error.log`,
          handleExceptions: true,
          handleRejections: true,
        }),
      ],
    });

    if (process.env.NODE_ENV !== "production") {
      // add a console logger when not in production
      logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf((info) => `[${info.level}]: ${info.message}${info?.metadata?.stack || ""}`)
          ),
        })
      );
    }

    // and create the instance
    this.instance = new Logger(logger, outputChannel);
  }

  /**
   * Ends the logging.
   * This should be called in the deactivate method.
   * After this method call, no more logging is possible.
   */
  static end() {
    if (this.instance) {
      this.instance.logger.end();
    }
  }
}

/**
 * A custom transport for any logs.
 * This will write the logs to the `vscode.OutputChannel`.
 */
class VSCodeOutputChannelTransport extends TransportStream {
  /**
   * Creates the custom transport for any logs.
   * @param outputChannel - the output channel where any logs should be written
   * @param opts - the options for the transport
   */
  constructor(private outputChannel: vscode.OutputChannel, opts?: TransportStreamOptions) {
    super(opts);
    this.outputChannel = outputChannel;
  }

  log(info: never, callback: () => void) {
    // appends the message to the output channel
    this.outputChannel.appendLine(info[Symbol.for("message")]);

    setImmediate(() => {
      this.emit("logged", info);
    });

    callback();
  }
}
