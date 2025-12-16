import { Logger, LoggingMessage, LoggingMessageWithLevel } from "../src";
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
  /**
   * The name of this used logger.
   */
  const loggerName = "MyLogger";

  /**
   * The folder where all the logs are stored
   */
  const loggingFolder = path.join(__dirname, "..", "..", "temp");

  /**
   * The normal logging file where any message should be logged.
   */
  const loggingFile = path.join(loggingFolder, `${loggerName}.log`);

  /**
   * The logging file for all error messages.
   */
  const errorLogFile = path.join(loggingFolder, `error.log`);

  /**
   * The output channel for later spying. This will be set after the creation in `suiteSetup`.
   */
  let outputChannel: vscode.OutputChannel;

  const createArgumentsWithNotUsedError = (expected: string, showMessage: ShowMessages): TestCase<LoggingMessage> => {
    return {
      name: "with not used error",
      expected,
      showMessage,
      loggingMessage: { message: LOGGING_MESSAGE, error: new Error("dummy") },
    };
  };

  const createArgumentWithIgnoreFormatToFalseForOutputChannel = (
    expected: string,
    showMessage: ShowMessages
  ): TestCase<LoggingMessage> => {
    return {
      name: "with ignoreFormatForOutputChannel set to false (no impact)",
      expected,
      showMessage,
      loggingMessage: { message: LOGGING_MESSAGE, ignoreFormatForOutputChannel: false },
    };
  };

  const createArgumentWithIgnoreFormatForOutputChannel = (
    expected: string,
    showMessage: ShowMessages
  ): TestCase<LoggingMessage> => {
    return {
      name: "with ignoreFormatForOutputChannel set to true",
      expected,
      showMessage,
      loggingMessage: { message: LOGGING_MESSAGE, ignoreFormatForOutputChannel: true },
    };
  };

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

    // spy the output channel creation
    const outputChannelCreation = Sinon.spy(vscode.window, "createOutputChannel");

    // create minimal extension context
    const uri = vscode.Uri.file(loggingFolder);
    const context: vscode.ExtensionContext = {
      subscriptions: [],
      logUri: uri,
    } as unknown as vscode.ExtensionContext;

    // initialize the logger
    Logger.initializeLogger(context, loggerName);

    // the output channel should be created somewhere
    Sinon.assert.called(outputChannelCreation);
    // and take the created output channel for further checks
    outputChannel = outputChannelCreation.returnValues[0];
    assert.equal(loggerName, outputChannel.name, "output channel should have the same name as the logger");

    // check that the output channel was added to the subscriptions
    assert.strictEqual(1, context.subscriptions.length, "one subscription should be added");
    assert.strictEqual(outputChannel, context.subscriptions[0], "output channel is the subscription");

    assert.ok(fs.existsSync(loggingFolder), "logging folder should be created");
  });

  /**
   * Restore after every test all sinon spy object to its normal state.
   */
  teardown("restore everything", () => {
    Sinon.restore();
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
    const showMethod = Sinon.spy(outputChannel, "show");

    Logger.getLogger().showOutputChannel();

    Sinon.assert.called(showMethod);

    showMethod.restore();
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
      createArgumentsWithNotUsedError(expected, {}),
      createArgumentWithIgnoreFormatToFalseForOutputChannel(expected, {}),
      createArgumentWithIgnoreFormatForOutputChannel(expected, {}),
    ];

    debugCases.forEach((testCase) => {
      test(`call debug (${testCase.name})`, async () => {
        await assertLogging(testCase.expected, testCase.showMessage, () =>
          Logger.getLogger().debug(testCase.loggingMessage)
        );
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
      createArgumentsWithNotUsedError(expected, { outputChannel: true }),
      createArgumentWithIgnoreFormatToFalseForOutputChannel(expected, { outputChannel: true }),
      createArgumentWithIgnoreFormatForOutputChannel(expected, { outputChannel: LOGGING_MESSAGE }),
    ];
    infoCases.forEach((testCase) => {
      test(`call info (${testCase.name})`, async () => {
        await assertLogging(testCase.expected, testCase.showMessage, () =>
          Logger.getLogger().info(testCase.loggingMessage)
        );
      });
    });

    /**
     * Tests that everything works when the first dialog result was given.
     */
    test("should handle ok result from vscode message", async () => {
      await assertLoggingWithDialogResult(expected, () =>
        Logger.getLogger().info({
          message: LOGGING_MESSAGE,
          notifyUser: true,
        })
      );
    });

    /**
     * Tests that everything still works when having an error while handling the shown message from vscode.
     */
    test("should work with error while showing the vscode message", async () => {
      await assertErrorOnShow(expected, /\[error\] Error showing the info message fooError: foo/, () =>
        Logger.getLogger().info({
          message: LOGGING_MESSAGE,
          notifyUser: true,
        })
      );
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
      createArgumentsWithNotUsedError(expected, { outputChannel: true }),
      createArgumentWithIgnoreFormatToFalseForOutputChannel(expected, { outputChannel: true }),
      createArgumentWithIgnoreFormatForOutputChannel(expected, { outputChannel: LOGGING_MESSAGE }),
    ];
    warnCases.forEach((testCase) => {
      test(`call warn (${testCase.name})`, async () => {
        await assertLogging(testCase.expected, testCase.showMessage, () =>
          Logger.getLogger().warn(testCase.loggingMessage)
        );
      });
    });

    /**
     * Tests that everything works when the first dialog result was given.
     */
    test("should handle ok result from vscode message", async () => {
      await assertLoggingWithDialogResult(expected, () =>
        Logger.getLogger().warn({
          message: LOGGING_MESSAGE,
          notifyUser: true,
        })
      );
    });

    /**
     * Tests that everything still works when having an error while handling the shown message from vscode.
     */
    test("should work with error while showing the vscode message", async () => {
      await assertErrorOnShow(expected, /\[error\] Error showing the warning message fooError: foo/, () =>
        Logger.getLogger().warn({
          message: LOGGING_MESSAGE,
          notifyUser: true,
        })
      );
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
      createArgumentWithIgnoreFormatToFalseForOutputChannel(expected, { outputChannel: true, errorLog: true }),
      createArgumentWithIgnoreFormatForOutputChannel(expected, { outputChannel: LOGGING_MESSAGE, errorLog: true }),
      {
        name: "with ignoreFormatForOutputChannel set to true and error",
        expected: expectedWithError,
        showMessage: { outputChannel: LOGGING_MESSAGE, errorLog: true },
        loggingMessage: { message: LOGGING_MESSAGE, error, ignoreFormatForOutputChannel: true },
      },
    ];
    errorCases.forEach((testCase) => {
      test(`call error (${testCase.name})`, async () => {
        await assertLogging(testCase.expected, testCase.showMessage, () =>
          Logger.getLogger().error(testCase.loggingMessage)
        );
      });
    });

    /**
     * Tests that the output channel was shown when the button was clicked.
     */
    test("should open output channel on error", async () => {
      const showMethod = Sinon.spy(outputChannel, "show");

      await assertLoggingWithDialogResult(expected, () =>
        Logger.getLogger().error({
          message: LOGGING_MESSAGE,
          notifyUser: true,
        })
      );
      Sinon.assert.calledOnce(showMethod);
    });

    /**
     * Tests that everything still works when having an error while handling the shown message from vscode.
     */
    test("should work with error while showing the vscode message", async () => {
      await assertErrorOnShow(expected, /\[error\] Error showing the error message fooError: foo/, () =>
        Logger.getLogger().error({
          message: LOGGING_MESSAGE,
          notifyUser: true,
        })
      );
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
      test(`call log (${testCase.name})`, async () => {
        await assertLogging(testCase.expected, testCase.showMessage, () =>
          Logger.getLogger().log(testCase.loggingMessage)
        );
      });
    });
  });

  /**
   * Tests the clear method of the logger.
   */
  test("clear log file", () => {
    // create a spy object for the clear method
    const clear = Sinon.spy(outputChannel, "clear");

    // clear the log file
    Logger.getLogger().clear();

    // check if the clear method was called
    Sinon.assert.calledOnce(clear);
  });

  /**
   * Asserts that the logging is working as expected.
   *
   * @param expected - the expected text that should be written in the file. This text includes the level and message.
   * It does not include any timestamp because they are removed before the comparison
   * @param showMessage - the verify checks if any of the vscode messages are called to show any info, warn or error message
   * If any call happens, then the message of the method will be compared
   * @param loggerCall - the call of the log method. This happens after the stubbing initialization
   */
  async function assertLogging(expected: string, showMessage: ShowMessages, loggerCall: () => void): Promise<void> {
    // create necessary spy objects
    const informationMessage = Sinon.spy(vscode.window, "showInformationMessage");
    const warningMessage = Sinon.spy(vscode.window, "showWarningMessage");
    const errorMessage = Sinon.spy(vscode.window, "showErrorMessage");
    const appendLine = Sinon.spy(outputChannel, "appendLine");

    // reset the content of any log file.
    // This is called only in the assert function, because otherwise (when be done in teardown), you can not see the real file content after a test.
    fs.writeFileSync(loggingFile, "");
    fs.writeFileSync(errorLogFile, "");

    // do the logger call
    loggerCall();

    // Wait a bit after the logging call. This might update the logs.
    await new Promise((r) => setTimeout(r, 1_000));

    // assert the logged message
    assert.strictEqual(readLoggingFile(loggingFile), expected, "normal logging file");
    assert.strictEqual(readLoggingFile(errorLogFile), showMessage.errorLog ? expected : "", "error logging file");

    // checks that the message was written to the output channel
    if (showMessage.outputChannel) {
      Sinon.assert.calledWith(
        appendLine,
        Sinon.match(typeof showMessage.outputChannel === "string" ? showMessage.outputChannel : expected)
      );
    } else {
      Sinon.assert.notCalled(appendLine);
    }

    // check if information message is called
    if (showMessage.informationMessage) {
      Sinon.assert.calledWith(informationMessage, LOGGING_MESSAGE);
    } else {
      Sinon.assert.notCalled(informationMessage);
    }

    // check if warning message is called
    if (showMessage.warningMessage) {
      Sinon.assert.calledWith(warningMessage, LOGGING_MESSAGE);
    } else {
      Sinon.assert.notCalled(warningMessage);
    }

    // check if error message is called
    if (showMessage.errorMessage) {
      Sinon.assert.calledWith(errorMessage, LOGGING_MESSAGE);
    } else {
      Sinon.assert.notCalled(errorMessage);
    }

    // restore all spy objects
    Sinon.restore();
  }

  /**
   * Asserts the logging, when the first item from the dialog was selected.
   *
   * @param expected - the expected message that should be logged
   * @param loggerCall - the logger call. This should have `notifyUser` to `true`.
   */
  async function assertLoggingWithDialogResult(expected: string, loggerCall: () => void): Promise<void> {
    const selectFirstItem = async (
      _message: string,
      _options: vscode.MessageOptions,
      ...items: vscode.MessageItem[]
    ): Promise<vscode.MessageItem> => {
      return items[0];
    };

    Sinon.stub(vscode.window, "showInformationMessage").callsFake(selectFirstItem);
    Sinon.stub(vscode.window, "showWarningMessage").callsFake(selectFirstItem);
    Sinon.stub(vscode.window, "showErrorMessage").callsFake(selectFirstItem);

    fs.writeFileSync(loggingFile, "");

    loggerCall();

    // Wait for the next tick to ensure all async operations are complete, because we are waiting for our async dialog result
    await new Promise((resolve) => setImmediate(resolve));

    assert.strictEqual(readLoggingFile(loggingFile), expected, "normal logging file");
  }

  /**
   * Assert that an error on the showXXX methods will be handled correctly.
   *
   * @param expected - the expected message
   * @param expectedError - the additional expected message from the logged error
   * @param loggerCall - the logger call. This should have `notifyUser` to `true`.
   */
  async function assertErrorOnShow(expected: string, expectedError: RegExp, loggerCall: () => void): Promise<void> {
    const errorReturn = Promise.reject(new Error("foo"));
    Sinon.stub(vscode.window, "showInformationMessage").returns(errorReturn);
    Sinon.stub(vscode.window, "showWarningMessage").returns(errorReturn);
    Sinon.stub(vscode.window, "showErrorMessage").returns(errorReturn);

    fs.writeFileSync(loggingFile, "");

    loggerCall();

    // Wait for the next tick to ensure all async operations are complete, because we are waiting for our async dialog result
    await new Promise((resolve) => setImmediate(resolve));

    const loggingFileContent = readLoggingFile(loggingFile);
    assert.ok(loggingFileContent.includes(expected), `normal logging file: normal message: ${loggingFileContent}`);
    assert.match(loggingFileContent, expectedError, "normal logging file: additional error");
  }
});

/**
 * Reads the logging file any removes any date time stamps.
 *
 * @param filename - the file name of the logging file that should be read
 * @returns the content without any timestamps
 */
function readLoggingFile(filename: string): string {
  assert.ok(fs.existsSync(filename), "logging file is there");
  const fileContent = fs.readFileSync(filename, { encoding: "utf-8" });

  // Date Pattern is YYYY-MM-DD HH:mm:ss
  const dateRegex = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g;
  // remove the from the log file
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
   *
   * If a `string` was given, then a other message than expected should be written
   */
  outputChannel?: boolean | string;

  /**
   * If the message should be written to a second log file for errors (`error.log`).
   */
  errorLog?: boolean;
}
