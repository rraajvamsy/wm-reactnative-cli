import { Config } from "../config/config";
const axios = require('axios');

export class Path{
    config: Config;
    constructor(config: Config){
        this.config = config;
    }

    async getProjectName() {
        const response = (await axios.get(`${this.config.previewConfig.previewUrl}/services/application/wmProperties.js`).catch((e: any)=>{
            console.log("Failed to get Project name")
            process.exit(0);
        }))
        this.config.projectConfig.projectName = response && JSON.parse(response.data.split('=')[1].replace(';', '')).displayName;
    }
    
    getWmProjectDir() {
        this.config.projectConfig.wmProjectDir =  `${this.config.projectConfig.projectDir}/src/main/webapp`;
    }

    getExpoProjectDir() {
        if (this.config.previewConfig.isWebExpo || this.config.previewConfig.isEsBuild) {
            this.config.projectConfig.expoProjectDir = `${this.config.projectConfig.projectDir}/target/generated-rn-web-app`;
        }
        this.config.projectConfig.expoProjectDir = `${this.config.projectConfig.projectDir}/target/generated-expo-app`;
    }
}