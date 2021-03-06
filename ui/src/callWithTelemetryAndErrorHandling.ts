/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OutputChannel, window } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { IActionContext } from '../index';
import { IParsedError } from '../index';
import { localize } from './localize';
import { parseError } from './parseError';

// tslint:disable-next-line:no-any
export async function callWithTelemetryAndErrorHandling(callbackId: string, telemetryReporter: TelemetryReporter | undefined, outputChannel: OutputChannel | undefined, callback: (this: IActionContext) => any): Promise<any> {
    const start: number = Date.now();
    const context: IActionContext = {
        properties: {
            isActivationEvent: 'false',
            result: 'Succeeded',
            error: '',
            errorMessage: ''
        },
        measurements: {
            duration: 0
        },
        suppressTelemetry: false,
        suppressErrorDisplay: false,
        rethrowError: false
    };

    try {
        return await Promise.resolve(callback.call(context));
    } catch (error) {
        const errorData: IParsedError = parseError(error);
        if (errorData.isUserCancelledError) {
            context.properties.result = 'Canceled';
            context.suppressErrorDisplay = true;
            context.rethrowError = false;
        } else {
            context.properties.result = 'Failed';
            context.properties.error = errorData.errorType;
            context.properties.errorMessage = errorData.message;
        }

        if (!context.suppressErrorDisplay && outputChannel) {
            // Always append the error to the output channel, but only 'show' the output channel for multiline errors
            outputChannel.appendLine(localize('outputError', 'Error: {0}', errorData.message));
            if (errorData.message.includes('\n')) {
                outputChannel.show();
                window.showErrorMessage(localize('multilineError', 'An error has occured. Check output window for more details.'));
            } else {
                window.showErrorMessage(errorData.message);
            }
        }

        if (context.rethrowError) {
            throw error;
        }
    } finally {
        if (telemetryReporter && !context.suppressTelemetry) {
            const end: number = Date.now();
            context.measurements.duration = (end - start) / 1000;
            telemetryReporter.sendTelemetryEvent(callbackId, context.properties, context.measurements);
        }
    }
}
