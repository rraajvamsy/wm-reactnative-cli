import { Config } from "../config/config";
import fs from 'fs-extra';
import { logger } from "../utils/logger";
import path from 'path';
import prompt from 'prompt';
import axios from "axios";
import os from 'os';
import semver from 'semver';
import { exec } from '../utils/exec';
import {unzip} from '../utils/zip';

export class Project{
    config: Config;
    STORE_KEY: string;
    remoteBaseCommitId: string;
    constructor(config: Config){
        this.config = config;
        this.STORE_KEY = 'user.auth.token';
        this.remoteBaseCommitId = '';
    };

    async findProjectId(){
        const projectList = (await axios.get(`${this.config.projectConfig!.baseUrl}/edn-services/rest/users/projects/list`,
        {headers: {
            cookie: this.config.projectConfig.authCookie
        }})).data;
        const project = projectList.filter((p: any) => p.displayName === this.config.projectConfig.projectName)
            .filter((p: any) => (this.config.previewConfig.previewUrl.indexOf(p.name + "_" + p.vcsBranchId) >= 0));
        if (project && project.length) {
            this.config.projectConfig.platformVersion = project[0].platformVersion;
            this.config.projectConfig.projectId = project[0].studioProjectId;
        }
    };


    async isAuthenticated(){
        try {
            await this.findProjectId();
            logger.info({
                label: 'project-sync-service',
                message: `user authenticated.`
            });
        } catch(e) {
            return false;
        }
        return true;    
    };

    getAuthToken() {
        var schema = {
            properties: {
                token: {
                    required: true
                }
            }
          };
        prompt.start();
        return new Promise(function(resolve, reject){
            prompt.get(schema, function(err: any, result: any){
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    };

    async authenticate(showHelp?: boolean){
        if (showHelp) {
            console.log('***************************************************************************************');
            console.log('* Please open the below url in the browser, where your WaveMaker studio is opened.    *');
            console.log('* Copy the response content and paste in the terminal.                                *');
            console.log('***************************************************************************************');
            console.log(`\n\n`);
            console.log(`${this.config.projectConfig.baseUrl}/studio/services/auth/token`);
            console.log(`\n\n`);
        }
        const cookie = (await this.getAuthToken() as any).token.split(';')[0];
        if (!cookie) {
            console.log('Not able to login. Try again.');
            return this.authenticate();
        }
        this.config.projectConfig.authCookie = 'auth_cookie='+cookie;
    };

    async gitResetAndPull(tempDir: string){
        await exec('git', ['reset', '--hard', 'master'], {cwd: this.config.projectConfig.projectDir});
        await exec('git', ['clean', '-fd'], {cwd: this.config.projectConfig.projectDir});
        await exec('git', ['pull', path.join(tempDir, 'remoteChanges.bundle'), 'master'], {cwd: this.config.projectConfig.projectDir});
    };

    async downloadFile(res: any, tempFile: any){
        if (res.status !== 200) {
            throw new Error('failed to download the project');
        }
        await new Promise(function(resolve, reject){
            const fw = fs.createWriteStream(tempFile);
            res.data.pipe(fw);
            fw.on('error', function(err: any){
                reject(err);
                fw.close();
            });
            fw.on('close', resolve);
        });
    };

    async setupProject( authToken: string) {
        if (authToken) {
            this.config.projectConfig.authCookie = 'auth_cookie=' + authToken;
        }
        const isAuthenticated = await this.isAuthenticated();
        if (!isAuthenticated) {
            await this.authenticate(true);
        }
        this.config.localstorage.setItem(this.STORE_KEY, this.config.projectConfig.authCookie);
        await this.downloadProject();
        return async() => await this.pullChanges();
    };

    async  downloadProject() {
        const start = Date.now();
        logger.info({label: 'project-sync-service',message: 'downloading the project...'});
        const tempFile = `${os.tmpdir()}/changes_${Date.now()}.zip`;
        this.config.projectConfig.latestVersion = !semver.lt(this.config.projectConfig.platformVersion, '11.4.0');
        if (!this.config.projectConfig.latestVersion) {
            const res = await axios.get(`${this.config.projectConfig.baseUrl}/studio/services/projects/${this.config.projectConfig.projectId}/vcs/gitInit`, {
                responseType: 'stream',
                headers: {
                    cookie: this.config.projectConfig.authCookie
                }
             }).catch((e: any) => {
                console.log("Failed to download Project");
                process.exit(0);
             });
            await this.downloadFile(res, tempFile);
            const gitDir = path.join(this.config.projectConfig.projectDir, '.git');
            fs.mkdirSync(gitDir);
            await unzip(tempFile, gitDir);
            await exec('git', ['restore', '.'], {cwd: this.config.projectConfig.projectDir});
        }
        else{
            const gitInfo = await axios.get(`${this.config.projectConfig.baseUrl}/studio/services/projects/${this.config.projectConfig.projectId}/vcs/gitBare`, {
                responseType: 'application/json' as any,
                headers: {
                    cookie: this.config.projectConfig.authCookie
                }
             }).catch((e: any) => {
                console.log("Failed to download Project");
                process.exit(0);
             });
            if(gitInfo?.status !== 200){
                throw new Error('failed to download the project');
            }
            const fileId = gitInfo.data.fileId;
            this.remoteBaseCommitId = gitInfo.data.remoteBaseCommitId;
            const res = await axios.get(`${this.config.projectConfig.baseUrl}/file-service/${fileId}`, {
                responseType: 'stream',
                headers: {
                    cookie: this.config.projectConfig.authCookie
                }
            }).catch((e: any) => {
                console.log("Failed to download Project");
             });
            await this.downloadFile(res, tempFile);
            const tempDir = path.join(`${os.tmpdir()}`, `project_${Date.now()}`);
            fs.mkdirSync(tempDir);
            const gitDir = path.join(this.config.projectConfig.projectDir, '.git');
            if(fs.existsSync(gitDir)){
                await unzip(tempFile, gitDir);
                await exec('git', ['config', '--local', '--unset', 'core.bare'], {cwd: this.config.projectConfig.projectDir});
                await exec('git', ['restore', '.'], {cwd: this.config.projectConfig.projectDir});
            }
            else{
                await unzip(tempFile, tempDir);
                fs.rm(this.config.projectConfig.projectDir, { recursive: true, force: true });
                await exec('git', ['clone', "-b", "master", tempDir, this.config.projectConfig.projectDir]);
            }
            fs.rm(tempDir, { recursive: true, force: true });
        }
        logger.info({
            label: 'project-sync-service',
            message: `downloaded the project in (${Date.now() - start} ms).`
        });
        fs.unlink(tempFile);
    };

    async pullChanges() {
        const output = await exec('git', ['rev-parse', 'HEAD'], {
            cwd: this.config.projectConfig.projectDir
        }) as any;
        const headCommitId = output[0];
        logger.debug({label: 'project-sync-service', message: 'HEAD commit id is ' + headCommitId});
        logger.info({label: 'project-sync-service', message: 'pulling new changes from studio...'});
        const tempDir = path.join(`${os.tmpdir()}`, `changes_${Date.now()}`);
        if (!this.config.projectConfig.latestVersion) {
            const tempFile = `${os.tmpdir()}/changes_${Date.now()}.zip`;
            console.log(tempFile);
            const res = await axios.get(`${this.config.projectConfig.baseUrl}/studio/services/projects/${this.config.projectConfig.projectId}/vcs/remoteChanges?headCommitId=${headCommitId}`, {
                responseType: 'stream',
                headers: {
                    cookie: this.config.projectConfig.authCookie
                }
            }).catch((e: any) => {
                console.log("Failed to pull project changes");
             });
            await this.downloadFile(res, tempFile);
            fs.mkdirSync(tempDir);
            await unzip(tempFile, tempDir);
        
            await this.gitResetAndPull(tempDir);
            await exec('git', ['apply', '--allow-empty', '--ignore-space-change', path.join(tempDir, 'patchFile.patch')], {cwd: this.config.projectConfig.projectDir});
            logger.debug({label: 'project-sync-service', message: 'Copying any uncommitted binary files'});
            this.config.copyContentsRecursiveSync(path.join(tempDir, 'binaryFiles'), this.config.projectConfig.projectDir!);    
            fs.unlink(tempFile);
        }
        else{
            const gitInfo = await axios.get(`${this.config.projectConfig.baseUrl}/studio/services/projects/${this.config.projectConfig.projectId}/vcs/pull?lastPulledWorkspaceCommitId=${headCommitId}&lastPulledRemoteHeadCommitId=${this.remoteBaseCommitId}`, {
                responseType: 'application/json' as any,
                headers: {
                    cookie: this.config.projectConfig.authCookie
                }
            }).catch((e: any) => {
                console.log("Failed to pull project changes");
            }) as any;
            if (gitInfo.status !== 200) {
                throw new Error('failed to pull project changes');
            }
            const fileId = gitInfo.data.fileId;
            this.remoteBaseCommitId = gitInfo.data.remoteBaseCommitId;
            const res = await axios.get(`${this.config.projectConfig.baseUrl}/file-service/${fileId}`, {
                responseType: 'stream',
                headers: {
                    cookie: this.config.projectConfig.authCookie
                }
            }).catch((e: any) => {
                console.log("Failed to pull project changes");
             });
            fs.mkdirSync(tempDir);
            const tempFile = `${tempDir}/remoteChanges.bundle`;
            await this.downloadFile(res, tempFile);
            await this.gitResetAndPull(tempDir);
            fs.unlink(tempFile);
        }
        fs.rm(tempDir, { recursive: true, force: true });
    }
}