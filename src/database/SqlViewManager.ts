import { WebviewPanel } from "vscode";
"use strict";
import * as fs from "fs";
import * as vscode from "vscode";
import { Console } from "../common/OutputChannel";
import { ConnectionManager } from "./ConnectionManager";
import { MySQLTreeDataProvider } from "../provider/MysqlTreeDataProvider";
import { OperateType } from "../common/Constants";
import { QueryUnit } from "./QueryUnit";

export class ViewOption {
    viewPath?: string;
    viewTitle?: string;
    sql?: string;
    data?: any;
    splitResultView: boolean = false;
    costTime?: number;
    /**
     * receive webview send message 
     */
    receiveListener?: (message: any) => {}

    disposeListener?: (message: any) => {}
}

export class SqlViewManager {
    static resultWebviewPanel: WebviewPanel
    static tableEditWebviewPanel: WebviewPanel
    static tableCreateWebviewPanel: WebviewPanel
    static extensionPath: string
    public static initExtesnsionPath(extensionPath: string) {
        this.extensionPath = extensionPath
    }

    public static showQueryResult(viewOption: ViewOption) {

        if (this.resultWebviewPanel) {
            if (this.resultWebviewPanel.visible) {
                this.resultWebviewPanel.webview.postMessage(viewOption)
                this.resultWebviewPanel.reveal(vscode.ViewColumn.Two, true);
                return;
            } else {
                this.resultWebviewPanel.dispose()
            }

        }

        viewOption.viewPath = "result"
        viewOption.viewTitle = "Query"

        this.createWebviewPanel(viewOption).then(webviewPanel => {
            this.resultWebviewPanel = webviewPanel
            webviewPanel.webview.postMessage(viewOption)
            webviewPanel.onDidDispose(() => { this.resultWebviewPanel = undefined })
            webviewPanel.webview.onDidReceiveMessage((params) => {
                if (params.type == OperateType.execute) {
                    QueryUnit.runQuery(params.sql)
                }
            })
        })


    }

    public static showConnectPage() {

        this.createWebviewPanel({
            viewPath: "connect",
            viewTitle: "connect",
            splitResultView: false
        }).then(webviewPanel => {
            webviewPanel.webview.onDidReceiveMessage((params) => {
                if (params.type === 'CONNECT_TO_SQL_SERVER') {
                    ConnectionManager.getConnection(params.connectionOption).then(() => {
                        MySQLTreeDataProvider.instance.addConnection(params.connectionOption);
                        webviewPanel.dispose();
                    }).catch((err: Error) => {
                        webviewPanel.webview.postMessage({
                            type: 'CONNECTION_ERROR',
                            err
                        });
                    })
                }
            });
        })
    }

    private static createWebviewPanel(viewOption: ViewOption): Promise<WebviewPanel> {

        let columnType = viewOption.splitResultView ? vscode.ViewColumn.Two : vscode.ViewColumn.One

        return new Promise((resolve, reject) => {
            fs.readFile(`${this.extensionPath}/resources/webview/${viewOption.viewPath}.html`, 'utf8', async (err, data) => {
                if (err) {
                    Console.log(err)
                    reject(err)
                    return;
                }
                const webviewPanel = await vscode.window.createWebviewPanel(
                    "mysql.sql.result",
                    viewOption.viewTitle,
                    {viewColumn:columnType,preserveFocus:true},
                    { enableScripts: true, retainContextWhenHidden: true }
                );
                webviewPanel.webview.html = data.replace(/\$\{webviewPath\}/gi,
                    vscode.Uri.file(`${this.extensionPath}/resources/webview`)
                        .with({ scheme: 'vscode-resource' }).toString())
                webviewPanel.webview.onDidReceiveMessage(viewOption.receiveListener);
                webviewPanel.onDidDispose(viewOption.disposeListener)

                resolve(webviewPanel)
            })

        })

    }

}