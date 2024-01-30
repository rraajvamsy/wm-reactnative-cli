import execa from "execa";
import { logger } from './logger'
const  loggerLabel  = 'exec'



class OutputPipe {
    output: string;
    content: any[];
    bufferSize: number;
    logOutput: boolean;
    loggerLabel: string;
    constructor(bufferSize: number, log: boolean) {
        this.output = '';
        this.content = [];
        this.bufferSize = bufferSize || 100;
        this.logOutput = (log !== false);
        this.loggerLabel = loggerLabel;
    }
    log(str: string, isErrorType?: any) {
        let reminder = '';
        str.split('\n').forEach((v, i, splits) => {
            if (i < splits.length - 1) {
                v && (this.logOutput || isErrorType) && logger.debug({label: this.loggerLabel, message: v});
                if (this.content.length > this.bufferSize) {
                    this.content.shift();
                }
                this.content.push(v);
            } else {
                reminder = v;
            }
        });
        return reminder;
    }
    push(str: string, isErrorType?: any) {
        if (str) {
            this.output = this.log(this.output + str, isErrorType) || '';
        }
    }
    flush() {
        this.log(this.output + '\n');
    }
}

export async function exec(cmd: any, args: any, options?: any) {
    logger.debug({label: 'exec', message: 'executing: ' + cmd + ' ' + (args && args.join(' '))});
        const outputPipe = new OutputPipe(100, options && options.log);
        const spawn = execa(cmd, args, options);
        spawn.stdout!.on('data', (data: any) => {
            outputPipe.push(String.fromCharCode.apply(null, new Uint16Array(data) as any));
        });
        spawn.stderr!.on('data', (data: any) => {
            outputPipe.push(String.fromCharCode.apply(null, new Uint16Array(data) as any), true);
        });
        return new Promise((resolve, reject) => {
            spawn.on('close', (code: any) => {
                outputPipe.flush();
                if (code == 0) {
                    resolve(outputPipe.content);
                } else {
                    reject(code);
                }
            });
        });
    
}

