import { Config } from "../config/config";
import fs from 'fs-extra';
import { logger } from "../utils/logger";
import { exec } from '../utils/exec';
import {Path} from '../utils/path';
import { Codegen } from "./codegen";
import rimraf from 'rimraf';
import { Project } from "./project";

export class PreviewUtils{
    project: any;
    config: Config;
    constructor(config: Config){
        this.config = config;
    }

    async iterateFiles(path: string, callBack: Function) {
        if (fs.lstatSync(path).isDirectory()) {
            await Promise.all(fs.readdirSync(path).map((p: string) => this.iterateFiles(`${path}/${p}`, callBack)));
        } else {
            await callBack && callBack(path);
        }
    }

    clean(path: string) {
        if (fs.existsSync(path)) {
            rimraf.sync(path, {recursive: true});
        }
        fs.mkdirSync(path, {recursive: true});
    }
    
    async  updatePackageJsonFile(path: string) {
        let data = fs.readFileSync(path, 'utf-8');
        const jsonData = JSON.parse(data);
        if (jsonData['dependencies']['expo-file-system'] === '^15.1.1') {
            jsonData['dependencies']['expo-file-system'] = '15.2.2'
        }
        if(this.config.previewConfig.isEsBuild || this.config.previewConfig.isWebExpo){
            jsonData['dependencies']['react-native-svg'] = '13.4.0';
            jsonData['dependencies']['expo-camera'] = '13.6.0';
        }
        fs.writeFileSync(path, JSON.stringify(jsonData), 'utf-8');
        logger.info({
            'label': "updatePackageJsonFile",
            'message': 'updated package.json file'
        });
    }

    async installDependencies() {
        await this.updatePackageJsonFile(this.config.projectConfig.expoProjectDir+ '/package.json');
        await exec('npm', ['install'], {
            cwd: this.config.projectConfig.expoProjectDir
        });
    }
    
    async installExpoWebDependencies() {
        if (fs.existsSync(`${this.config.projectConfig.expoProjectDir}/node_modules/expo`)) {
            return;
        }
        await exec('npm', ['install'], {
            cwd: this.config.projectConfig.expoProjectDir
        });
        await exec('node', ['./esbuild/esbuild.script.js', '--prepare-lib'], {
            cwd: this.config.projectConfig.expoProjectDir
        });
        fs.copySync(
            `${this.config.projectConfig.expoProjectDir}/esbuild/node_modules`, 
            `${this.config.projectConfig.expoProjectDir}/node_modules`,
            {
            overwrite: true
            });
        const nodeModulesDir = `${this.config.projectConfig.expoProjectDir}/node_modules/@wavemaker/app-rn-runtime`;
        this.config.readAndReplaceFileContent(`${nodeModulesDir}/core/base.component.js`, (c: string) => c.replace(/\?\?/g, '||'));
        this.config.readAndReplaceFileContent(`${nodeModulesDir}/components/advanced/carousel/carousel.component.js`, (c: string) => c.replace(/\?\?/g, '||'));
        this.config.readAndReplaceFileContent(`${nodeModulesDir}/components/input/rating/rating.component.js`, (c: string) => c.replace(/\?\?/g, '||'));
    }

    async setup( authToken?: string ) {
        const path = new Path(this.config);
        await path.getProjectName();
        this.config.projectConfig.projectDir = `${this.config.rootDir}/wm-projects/${this.config.projectConfig.projectName.replace(/\s+/g, '_').replace(/\(/g, '_').replace(/\)/g, '_')}`;
        path.getWmProjectDir();
        path.getExpoProjectDir();
        if (this.config.previewConfig.clean) {
            this.clean(this.config.projectConfig.projectDir);
        }
        this.project = new Project(this.config);
        this.config.projectConfig.syncProject = await this.project.setupProject(authToken);
        const codegen = new Codegen(this.config);
        await codegen.transpile();
    }
}