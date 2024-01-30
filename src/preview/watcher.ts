import { Config } from "../config/config";
import { Codegen } from "./codegen";
const {logger} = require('../utils/logger');
const axios = require('axios');
const fs = require('fs-extra');

export class Watcher{
    config: Config;
    codegen: any;
    constructor(config: any){
        this.config = config;
        this.codegen = new Codegen(this.config);
    }

    watchForPlatformChanges(callBack: Function) {
        let codegen = process.env.WAVEMAKER_STUDIO_FRONTEND_CODEBASE;
        if (!codegen) {
            return;
        }
        setTimeout(() => {
            let doBuild = false;
            if (fs.existsSync(`${codegen}/wavemaker-rn-runtime/dist/new-build`)) {
                fs.unlinkSync(`${codegen}/wavemaker-rn-runtime/dist/new-build`);
                doBuild = true;
            }
            if (fs.existsSync(`${codegen}/wavemaker-rn-codegen/dist/new-build`)) {
                fs.unlinkSync(`${codegen}/wavemaker-rn-codegen/dist/new-build`);
                doBuild = true;
            }
            if (doBuild && callBack) {
                console.log('\n\n\n')
                logger.info({
                    label: 'platform-changes',
                    message: 'Platform Changed. Building again.'
                });
                callBack().then(() => {
                    this.watchForPlatformChanges(callBack);
                });
            } else {
                this.watchForPlatformChanges(callBack);
            }
        }, 5000);
    }
    
    async watchProjectChanges(onChange: Function, lastModifiedOn?: string) {
        try {
            const response = await axios.get(`${this.config.previewConfig.previewUrl}/rn-bundle/index.html`, {
                headers: {
                    'if-modified-since' : lastModifiedOn || new Date().toString()
                }
            }).catch((e: any) => e.response);
            if (response.status === 200 && response.data.indexOf('<title>WaveMaker Preview</title>') > 0) {
                lastModifiedOn = response.headers['last-modified'];
                onChange();
            }
        } catch(e) {
            logger.debug({
                label: "projectchanges",
                message: e
            });
        }
        setTimeout(async () => await this.watchProjectChanges(onChange, lastModifiedOn), 5000);
    }
    
    async sync() {
        await this.watchProjectChanges(() => {
            const startTime = Date.now();
            this.config.projectConfig.syncProject()
            .then(() => {
                logger.info({
                    label: "sync",
                    message: `Sync Time: ${(Date.now() - startTime)/ 1000}s.`
                });
            }).then(() => this.codegen.transpile())
            .then(() => {
                logger.info({
                    label: "sync",
                    message: `Total Time: ${(Date.now() - startTime)/ 1000}s.`
                });
            });
        });
        this.watchForPlatformChanges(() => this.codegen.transpile());
    }
    
    async syncWeb() {
        await this.watchProjectChanges(() => {
            const startTime = Date.now();
            this.config.projectConfig.syncProject()
            .then(() => {
                logger.info({
                    label: 'web-sync',
                    message: `Sync Time: ${(Date.now() - startTime)/ 1000}s.`
                });
            })
            .then(() => {
                return this.codegen.transpile().then(() => {
                    logger.info({
                        label: 'web-sync',
                        message: `Total Time: ${(Date.now() - startTime)/ 1000}s.`
                    });
                });
            });
        });
        this.watchForPlatformChanges(() => this.codegen.transpile());
    }
    
}