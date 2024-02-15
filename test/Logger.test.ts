import { Logger, LoggingMessage, LoggingMessageWithLevel } from "../src";
import { ExtensionContext } from "vscode";
import assert from "assert";
import * as vscode from "vscode";
import path from "path";
import * as fs from "fs";
import Sinon from "sinon";
/**
 * The message that will be used for any logging call.
 */
const LOGGING_MESSAGE = "myMessage";

/**
 * Tests the logger.
 */
suite("Logger tests", () => {
  // create a minimal extension context for all tests
  const loggerName = "MyLogger";
  const loggingFolder = path.join(__dirname, "..", "..", "temp");
  const loggingFile = path.join(loggingFolder, `${loggerName}.log`);
  const errorLogFile = path.join(loggingFolder, `error.log`);

  const informationMessage = Sinon.spy(vscode.window, "showInformationMessage");
  const warningMessage = Sinon.spy(vscode.window, "showWarningMessage");
  const errorMessage = Sinon.spy(vscode.window, "showErrorMessage");

  let outputChannel: Sinon.SinonSpiedInstance<vscode.OutputChannel>;

  /**
   * Initializes the logger and checks if the initialization was valid.
   */
  suiteSetup("initialize logger", async () => {
    // remove any old logging folders from previous test runs
    if (fs.existsSync(loggingFolder)) {
      fs.rmSync(loggingFolder, { recursive: true });
    }
    assert.ok(!fs.existsSync(loggingFolder), new Error("no logging folder should be there"));

    // before any initialization, no logger can be returned
    assert.throws(() => Logger.getLogger(), new Error("no instance of the logger was created"), "before first init");

    const outputChannelSpy = Sinon.spy(vscode.window, "createOutputChannel");

    const uri = vscode.Uri.file(loggingFolder);
    const context: ExtensionContext = {
      subscriptions: [],
      logUri: uri,
    } as unknown as ExtensionContext;

    // initialize the logger
    Logger.initializeLogger(context, loggerName);

    // the output channel should be created somewhere
    Sinon.assert.called(outputChannelSpy);
    // and take it for further checks
    const actualOutputChannel: vscode.OutputChannel = outputChannelSpy.returnValues[0];

    outputChannel = Sinon.spy(actualOutputChannel);

    assert.strictEqual(1, context.subscriptions.length, "one subscription should be added");

    assert.ok(fs.existsSync(loggingFolder), "logging folder should be created");
  });

  /**
   * Ends the logging after the tests.
   * Also validates that you can no longer log anything (by calling a simple debug log call).
   */
  suiteTeardown("ends the logging", () => {
    // ends the logging
    Logger.end();

    // checks that logging is not longer possible
    assert.throws(
      () => Logger.getLogger().debug({ message: "should not log" }),
      Error,
      "should not log any message after end call"
    );
  });

  /**
   * Tests that the output channel should be shown when calling the corresponding method.
   */
  test("showOutputChannel", () => {
    Sinon.reset();

    Logger.getLogger().showOutputChannel();

    Sinon.assert.called(outputChannel.show);
  });

  /**
   * Tests the call of the debug log method.
   */
  suite("debug", () => {
    const expected = "[debug] myMessage";

    const debugCases: TestCase<LoggingMessage>[] = [
      // Tests the logging of a normal debug message.
      { name: "just log", expected, showMessage: {}, loggingMessage: { message: LOGGING_MESSAGE } },
      // Tests that a debug message with not used parameter notify user is logged correctly.
      {
        name: "with not used notify user",
        expected,
        showMessage: {},
        loggingMessage: { message: LOGGING_MESSAGE, notifyUser: true },
      },
      // Tests that a debug message with not used parameter error is still logged correctly.
      {
        name: "with not used error",
        expected,
        showMessage: {},
        loggingMessage: { message: LOGGING_MESSAGE, error: new Error("dummy") },
      },
    ];

    debugCases.forEach((testCase) => {
      test(`call debug (${testCase.name})`, () => {
        assertLogging(testCase.expected, testCase.showMessage, () => Logger.getLogger().debug(testCase.loggingMessage));
      });
    });
  });

  /**
   * Tests the call of the info log method.
   */
  suite("info", () => {
    const expected = "[info] myMessage";

    const infoCases: TestCase<LoggingMessage>[] = [
      // Tests the logging of a normal info message.
      {
        name: "just log",
        expected,
        showMessage: { outputChannel: true },
        loggingMessage: { message: LOGGING_MESSAGE },
      },
      // Tests the logging of an info message that will notify the user.
      {
        name: "notify user",
        expected,
        showMessage: { outputChannel: true, informationMessage: true },
        loggingMessage: { message: LOGGING_MESSAGE, notifyUser: true },
      },
      // Tests that a info message with an error will not use this error in the logging.
      {
        name: "with not used error",
        expected,
        showMessage: { outputChannel: true },
        loggingMessage: { message: LOGGING_MESSAGE, error: new Error("dummy") },
      },
    ];
    infoCases.forEach((testCase) => {
      test(`call info (${testCase.name})`, () => {
        assertLogging(testCase.expected, testCase.showMessage, () => Logger.getLogger().info(testCase.loggingMessage));
      });
    });
  });

  /**
   * Tests the call of the warn log method.
   */
  suite("warn", () => {
    const expected = "[warn] myMessage";

    const warnCases: TestCase<LoggingMessage>[] = [
      // Tests the logging of a normal warn message.
      {
        name: "just log",
        expected,
        showMessage: { outputChannel: true },
        loggingMessage: { message: LOGGING_MESSAGE },
      },
      // Tests the logging of an warn message that will notify the user.
      {
        name: "notify user",
        expected,
        showMessage: { outputChannel: true, warningMessage: true },
        loggingMessage: { message: LOGGING_MESSAGE, notifyUser: true },
      },
      // Tests that a warn message with an error will not use this error in the logging.
      {
        name: "with not used error",
        expected,
        showMessage: { outputChannel: true },
        loggingMessage: { message: LOGGING_MESSAGE, error: new Error("dummy") },
      },
    ];
    warnCases.forEach((testCase) => {
      test(`call warn (${testCase.name})`, () => {
        assertLogging(testCase.expected, testCase.showMessage, () => Logger.getLogger().warn(testCase.loggingMessage));
      });
    });
  });

  /**
   * Tests the call of the error log method.
   */
  suite("error", () => {
    // overwrite the stack of the error to test it better
    const error = new Error("unit test");
    error.stack = " - my stack trace";

    const expected = "[error] myMessage";
    const expectedWithError = "[error] myMessage unit test - my stack trace";

    const errorCases: TestCase<LoggingMessage>[] = [
      // Tests the logging of a normal error message.
      {
        name: "just log",
        expected,
        showMessage: { outputChannel: true, errorLog: true },
        loggingMessage: { message: LOGGING_MESSAGE },
      },
      // Tests the logging of an error message that will notify the user.
      {
        name: "notify user",
        expected,
        showMessage: { outputChannel: true, errorLog: true, errorMessage: true },
        loggingMessage: { message: LOGGING_MESSAGE, notifyUser: true },
      },
      // Tests that an error message with an error will log this error as well
      {
        name: "with used error",
        expected: expectedWithError,
        showMessage: { outputChannel: true, errorLog: true },
        loggingMessage: { message: LOGGING_MESSAGE, error },
      },
      // Tests that an additional error will not be shown for the user, but logged correctly
      {
        name: "with used error and notify user",
        expected: expectedWithError,
        showMessage: { outputChannel: true, errorLog: true, errorMessage: true },
        loggingMessage: { message: LOGGING_MESSAGE, error, notifyUser: true },
      },
    ];
    errorCases.forEach((testCase) => {
      test(`call error (${testCase.name})`, () => {
        assertLogging(testCase.expected, testCase.showMessage, () => Logger.getLogger().error(testCase.loggingMessage));
      });
    });
  });

  /**
   * Tests the call of the log method.
   */
  suite("log", () => {
    const logCases: TestCase<LoggingMessageWithLevel>[] = [
      // logs a message to debug level
      {
        name: "level:debug",
        expected: "[debug] myMessage",
        showMessage: {},
        loggingMessage: { level: "debug", message: LOGGING_MESSAGE },
      },
      // logs a message to info level
      {
        name: "level:info",
        expected: "[info] myMessage",
        showMessage: { outputChannel: true },
        loggingMessage: { level: "info", message: LOGGING_MESSAGE },
      },
      // logs a message to warn level
      {
        name: "level:warn",
        expected: "[warn] myMessage",
        showMessage: { outputChannel: true },
        loggingMessage: { level: "warn", message: LOGGING_MESSAGE },
      },
      // logs a message to error level
      {
        name: "level:error",
        expected: "[error] myMessage",
        showMessage: { outputChannel: true, errorLog: true },
        loggingMessage: { level: "error", message: LOGGING_MESSAGE },
      },
    ];
    logCases.forEach((testCase) => {
      test(`call log (${testCase.name})`, () => {
        assertLogging(testCase.expected, testCase.showMessage, () => Logger.getLogger().log(testCase.loggingMessage));
      });
    });
  });

  /**
   * Asserts that the logging is working as expected.
   *
   * @param expected - the expected text that should be written in the file. This text includes the level and message.
   *     It does not include any timestamp because they are removed before the comparison
   * @param callVerify - the verify checks if any of the vscode messages are called to show any info, warn or error message
   *     If any call happens, then the message of the method will be compared
   * @param loggerCall - the call of the log method. This happens after the stubbing initialization
   */
  function assertLogging(expected: string, callVerify: ShowMessages, loggerCall: () => void) {
    // reset the call history of the spy elements
    // informationMessage.resetHistory();
    // warningMessage.resetHistory();
    // errorMessage.resetHistory();
    Sinon.resetHistory();

    fs.writeFileSync(loggingFile, "");
    fs.writeFileSync(errorLogFile, "");

    // do the logger call
    loggerCall();

    // assert the logged message
    assert.strictEqual(expected, readLoggingFile(loggingFile), "normal logging file");
    assert.strictEqual(callVerify.errorLog ? expected : "", readLoggingFile(errorLogFile), "error logging file");

    // checks that the message was written to the output channel
    if (callVerify.outputChannel) {
      Sinon.assert.calledWith(outputChannel.appendLine, Sinon.match(expected));
    } else {
      Sinon.assert.notCalled(outputChannel.appendLine);
    }

    // check if information message is called
    if (callVerify.informationMessage) {
      Sinon.assert.calledWith(informationMessage, LOGGING_MESSAGE);
    } else {
      Sinon.assert.notCalled(informationMessage);
    }

    // check if warning message is called
    if (callVerify.warningMessage) {
      Sinon.assert.calledWith(warningMessage, LOGGING_MESSAGE);
    } else {
      Sinon.assert.notCalled(warningMessage);
    }

    // check if error message is called
    if (callVerify.errorMessage) {
      Sinon.assert.calledWith(errorMessage, LOGGING_MESSAGE);
    } else {
      Sinon.assert.notCalled(errorMessage);
    }
  }
});

/**
 * Reads the logging file any removes any date time stamps.
 * @param filename - the file name of the logging file that should be read
 * @returns the content without any timestamps
 */
function readLoggingFile(filename: string): string {
  assert.ok(fs.existsSync(filename), "logging file is there");
  const fileContent = fs.readFileSync(filename, { encoding: "utf-8" });

  // Date Pattern is YYYY-MM-DD hh:mi:ss and a space
  const dateRegex = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s*/g;

  return fileContent.replace(dateRegex, "").trim();
}

/**
 * Any test case for logging.
 */
interface TestCase<T> {
  /**
   * The name of the test case.
   */
  name: string;

  /**
   * The expected text that should be written in the log file and output channel.
   * This message does not include any dates.
   */
  expected: string;

  /**
   * The message that should be logged.
   */
  loggingMessage: T;

  /**
   * Information, where besides the standard log file should the message also visible.
   */
  showMessage: ShowMessages;
}
/**
 * Information, where besides the standard log file should the message also visible.
 * Any value that is not given, is interpreted as false.
 */
interface ShowMessages {
  /**
   * If the message should be displayed via `vscode.window.showInformationMessage`.
   */
  informationMessage?: boolean;

  /**
   * If the message should be displayed via `vscode.window.showWarningMessage`.
   */
  warningMessage?: boolean;

  /**
   * If the message should be displayed via `vscode.window.showErrorMessage`.
   */
  errorMessage?: boolean;

  /**
   * If the message should be written in the output channel.
   */
  outputChannel?: boolean;

  /**
   * If the message should be written to a second log file for errors (`error.log`).
   */
  errorLog?: boolean;
}
