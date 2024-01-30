import { Config } from "../config/config";
import http from 'http';
import request from 'request';
import httpProxy from 'http-proxy';
import { exec } from '../utils/exec';
import express from 'express';
import { logger } from '../utils/logger';
import fs from 'fs-extra';
import open from "open";

export class LaunchServices{

    config: Config;
    constructor(config: Config){
        this.config = config;
    }

    async launchExpo(){
        let args = ['expo', 'start', ];
        if (this.config.previewConfig.isWebExpo || this.config.previewConfig.isEsBuild) {
            args = args.concat(['--web', '--offline']);
        }
        await exec('npx', args, {
            cwd: this.config.projectConfig.expoProjectDir
        });
    }

    launchToolServer(barcode: number) {
        const app = express();
        const port = 19002;
        const url = this.config.previewConfig.expoUrl+barcode;
        app.use(express.static(__dirname + '/../../tools-site'));
        app.get("/", (req: any, res: any) => {
            const template = fs.readFileSync(__dirname+ '/../../tools-site/index.html.template', {
                encoding: "utf-8"
            });
            res.send(template.replace(/\{\{url\}\}/g, url));
        });
        app.listen(port);
        logger.info({
            label: 'launch-barcode',
            message: `open http://localhost:${port}/ in browser.`
        });
        open(`http://localhost:${port}/`);
    }

    async launchNative() {
        await exec('npx', [
            'react-native',
            this.config.previewConfig.nativeType === 'android' ? 'run-android' : 'run-ios'
        ], {
            cwd: this.config.projectConfig.expoProjectDir
        });
    }
    
    serviceProxy(webPreviewPort: number){
        const previewurl = this.config.previewConfig.previewUrl;
        const proxy =  httpProxy.createProxyServer({});

        http.createServer(function (req: any, res: any) {
            try {
                let tUrl = req.url;
                if (req.url === '/' || req.url.startsWith('/rn-bundle') || req.url.startsWith('/index.bundle')) {
                    tUrl = `http://localhost:${webPreviewPort}${req.url}`;
                    req.pipe(request(tUrl, function(res, err){
                        err && console.log(err);
                    })).pipe(res);
                } else {
                    proxy.web(req, res, {
                        target: previewurl,
                        secure: false,
                        xfwd: false,
                        changeOrigin: true,
                        cookiePathRewrite: {
                            "*": ""
                        }
                    });
                    tUrl = `${previewurl}/${req.url}`;
                }
            } catch(e) {
                res.writeHead(500);
                console.error(e);
            }
        }).listen(this.config.previewConfig.proxyPort);

        proxy.on('proxyReq', function(proxyReq: any, req: any, res: any, options: any) {
            proxyReq.setHeader('sec-fetch-mode', 'no-cors');
            proxyReq.setHeader('origin', previewurl);
            proxyReq.setHeader('referer', previewurl);
        });
        proxy.on('proxyRes', function(proxyRes: any, req: any, res: any, options: any) {
            var cookies = proxyRes.headers['set-cookie'];
            if (cookies) {
                cookies = typeof cookies === 'string' ? [cookies] : cookies;
                cookies = cookies.map((c: string) => c.replace(/;?\sSecure/, ''));
                proxyRes.headers['set-cookie'] = cookies;
            }
        });
        proxy.on('error', function(err: any, req: any, res: any){
            logger.error({
                label: "serviceProxy",
                message: err
            });
        })
        logger.info({
            label: "serviceProxy",
            message: `Service proxy launched at ${this.config.previewConfig.proxyUrl} .`
        });

    }

    launchWebServiceProxy() {
        let webPreviewPort = this.config.projectConfig.latestVersion ? 8081 : 19000;
        this.serviceProxy(webPreviewPort);
    }
    
    launchServiceProxy() {
        const app = express();
        let webPreviewPort = 19005
        app.use('/rn-bundle', express.static(this.config.projectConfig.wmProjectDir + '/rn-bundle'));
        app.get("*", (req: any, res: any) => {
            res.send(`
            <html>
                <head>
                    <script type="text/javascript">
                        location.href="/rn-bundle/index.html"
                    </script>
                </head>
            </html>`);
        });
        app.listen(webPreviewPort);
        this.serviceProxy(webPreviewPort);
    }
}