/** 
 # Copyright (c) 2026 Peter Sturm
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 */

import TargetHistory from './targethistory.mjs';
import { logDebug, logInfo } from './log.mjs';
import { drawCPA, lineIntersectsCanvas } from './tools.mjs';

export default async (fApi) => {

    const STOREKEYAISCPA = fApi.getStoreBaseKey() + ".AisCpa";
    fApi.setStoreData(STOREKEYAISCPA, true); // CPAs ares visible by default

    // AVNAV: draws AIS CPA line on map display widget
    var AisCpaParameter = {
        Opacity: {
            type: "FLOAT",
            default: 1.0,
            description: "Opacity of the CPA line and circles"
        },
        CircleRadius: {
            type: "NUMBER",
            default: 7,
            description: "Radius of the circles at own and target CPA positions"
        },
        FillColor: {
            type: "COLOR",
            default: "yellow",
            description: "Fill color of the circles at own and target CPA positions"
        },
        LineColor: {
            type: "COLOR",
            default: "red",
            description: "Color of the dashed line between own and target CPA positions"
        },
        StrokeWidthCircle: {
            type: "NUMBER",
            default: 1,
            description: "Width of the stroke for the circles at own and target CPA positions"
        },
        StrokeColorCircle: {
            type: "COLOR",
            default: "black",
            description: "Color of the stroke for the circles at own and target CPA positions"
        },
        DrawRealSize: {
            type: "BOOLEAN",
            default: true,
            description: "draw targets in real world size"
        },
        MinZoom: {
            type: "FLOAT",
            default: 11.0,
            description: "Minimum zoom level to draw CPA and real size targets"
        },
        HistoryTime: {
            type: "NUMBER",
            default: 10,
            description: "Time in minutes to store target history for drawing, 0 disables history drawing"
        },
        HistoryColor: {
            type: "COLOR",
            default: "#606060",
            description: "Color of the target history"
        },
        HistoryLineWidth: {
            type: "NUMBER",
            default: 2,
            description: "Width of the target history line"
        }   
    };


    var mTargetHistory = new TargetHistory(logInfo);
    let mLastUpdateCount = 0;

    var AisCpaWidget = {
        // Editable Parameters
        Opacity: 1.0,
        CircleRadius: 7,
        FillColor: 'yellow',
        LineColor: 'red',
        LineWidth: 4,
        StrokeWidthCircle: 1,
        StrokeColorCircle: 'black',
        DrawRealSize: true,
        MinZoom: 11,
        HistoryTime: 10,
        HistoryColor: '#606060',
        HistoryLineWidth: 2,
        name: "AisCpaWidget",
        type: "map",
        // Fordere einfach alles an, was dich interessiert
        storeKeys: {
            // see https://github.com/wellenvogel/avnav/blob/master/viewer/util/keys.ts
            aisList: 'nav.ais.list',
            aisUpdateCount: 'nav.ais.updateCount',
            position: 'nav.gps.position',
            course: 'nav.gps.course',
            speed: 'nav.gps.speed',
            currentZoom: 'map.currentZoom',
            navCircleColor: 'properties.navCircleColor',
            aisLayerVisible: 'properties.layers.ais'
        },
        initFunction: function (fCanvas, fProps) {
            logInfo("AisCpaWidget::initFunction() fProps = " + fProps + " history size = " + mTargetHistory.size());
            this.CPAOpacity = fProps.Opacity;
            this.CPAStrokeWidthCircle = fProps.StrokeWidthCircle;
            this.CPAFillColor = fProps.FillColor;
            this.CPACircleRadius = fProps.CircleRadius;
            this.CPALineColor = fProps.LineColor;
            this.CPALineWidth = fProps.LineWidth;
            this.CPAStrokeColorCircle = fProps.StrokeColorCircle;
            this.CPACourseColor = fProps.navCircleColor;
            this.CPADrawRealSize = fProps.DrawRealSize;
            this.CPAMinZoom = fProps.MinZoom;
            this.HistoryTime = fProps.HistoryTime;
            this.HistoryColor = fProps.HistoryColor;
            this.HistoryLineWidth = fProps.HistoryLineWidth;
        },
        finalizeFunction: function (fCanvas) {
            logInfo("AisCpaWidget::finalizeFunction()");
        },
        renderCanvas: function (fCanvas, fProps) {
            const aRenderStart = Date.now();
            try {
                //console.log("AisCpaWidget::renderCanvas() props = ", props);
                if (!fProps.aisLayerVisible || fProps.currentZoom < this.CPAMinZoom) {
                    return;
                }

                let aIsVisible = fApi.getStoreData(STOREKEYAISCPA);
                if (!aIsVisible) {
                    //console.log("AisCpaWidget::renderCanvas() not visible");
                    return;
                }

                var aSpeed = fProps.speed;
                if (!aSpeed) {
                    aSpeed = 0.0;
                }
                var aCourse = fProps.course;
                if (!aCourse) {
                    aCourse = 0.0;
                }

                var aCtx = fCanvas.getContext('2d');
                aCtx.save();

                //console.log("AisCpaWidget::renderCanvas() aisUpdateCount = ", fProps.aisUpdateCount);
                if (fProps.aisUpdateCount !== mLastUpdateCount) {
                    if ((fProps.aisUpdateCount - mLastUpdateCount) > 1) {
                        logInfo("renderCanvas(): AIS update count jumped from " + mLastUpdateCount + " to " + fProps.aisUpdateCount);
                    }
                    mLastUpdateCount = fProps.aisUpdateCount;
                }

                for (const aAisidx in fProps.aisList) {
                    const aAis = fProps.aisList[aAisidx];
                    try {

                        //console.log("AisCpaWidget::renderCanvas() ais warning for MMSI " + aAis.mmsi + ", name " + aAis.received.shipname + ", to_bow " + aAis.received.to_bow);
                        //console.log("AisCpaWidget::renderCanvas() ais = ", aAis);

                        var aTargetSpeed = aAis.received.speed || 0.0;
                        var aTargetCourse = aAis.received.course || 0.0;
                        var aTcpa = aAis.cpadata.tcpa || 0.0;

                        var aTargetData = aAis.received;
                        if (typeof aAis.estimated !== 'undefined' && aAis.estimated !== null 
                            && typeof aAis.estimated.lat !== 'undefined' && typeof aAis.estimated.lon !== 'undefined'   ) {
                            aTargetData = aAis.estimated;
                        }

                        if (typeof aTargetData === 'undefined' || aTargetData === null || typeof aTargetData.lat === 'undefined'
                          || typeof aTargetData.lon === 'undefined' || aTargetData.lat === null || aTargetData.lon === null) {
                            continue;
                        }

                        if (!(mTargetHistory instanceof TargetHistory)) {
                            mTargetHistory = new TargetHistory();
                            console.log("AisCpaWidget::saveHistory() creating targetHistory");
                        }
                        // todo move saveHistory() to timer outside rendering
                        const aHistory = mTargetHistory.saveHistory(aAis.mmsi, aAis.received, this.HistoryTime);

                        drawCPA(fApi, this, aCtx, aAis.warning, fProps.position, aSpeed, aCourse, aTargetData, aTargetSpeed, aTargetCourse,
                            aTcpa, aAis.received.length, aAis.received.beam, aAis.received.to_bow, aAis.received.to_port, aAis.received.heading,
                            aHistory.pos);
                    }
                    catch (aE) {
                        console.log("AisCpaWidget::renderCanvas() error while processing AIS data for mmsi " + aAis.mmsi, aE);
                    }
                }

                aCtx.restore();
                //console.log("AisCpaWidget::renderCanvas() fini");
            }
            finally {
                const aRenderDuration = Date.now() - aRenderStart;
                if (aRenderDuration > 20) {
                    logInfo("AisCpaWidget::renderCanvas() render time = " + aRenderDuration + "ms");
                }
            }
        }
    }

    logInfo("plugin.mjs check version");
    logInfo("plugin.mjs AvNav version: " + fApi.getAvNavVersion());
    if (fApi.getAvNavVersion() < 20261019) {
        logInfo("AIS CPA plugin requires AVNav version 20261019 or higher, please update your AVNav installation");
        fApi.showToast("AIS CPA plugin requires AVNav version 20261019 or higher, please update your AVNav installation");
        return;
    }

    fApi.registerWidget(AisCpaWidget, AisCpaParameter);
    logInfo("plugin.mjs registerWidget(AisCpaWidget, AisCpaParameter) done");

    fApi.registerUserButton({
        name: 'AisCpaButton',
        shortText: 'AIS CPA',
        longText: 'Show/Hide AIS CPA drawings',
        icon: 'images/icon.svg',
        toggle: true,
        storeKeys: {
            toggle: STOREKEYAISCPA
        },
        onClick: (fEv) => {
            //console.log("AisCpaWidget::onClick() ev = ", ev);
            let toggle = !fApi.getStoreData(STOREKEYAISCPA);
            fApi.setStoreData(STOREKEYAISCPA, toggle);
            //console.log("AisCpaWidget::onClick() toggle = ", toggle);
        }
    }, 'navpage');

    logInfo("plugin.mjs registerUserButton(AisCpaWidget, AisCpaParameter) done");
    logInfo("plugin.mjs loaded");
    logInfo("plugin.mjs name: " + fApi.getPluginName());
    logInfo("plugin.mjs baseUrl: " + fApi.getBaseUrl());
/*     const aCfg = await fApi.getConfig();
    logInfo("plugin.mjs config: " + JSON.stringify(aCfg)); */
    fApi.getConfig()
        .then((fCfg) => logInfo("plugin.mjs config: " + JSON.stringify(fCfg)))   
        .catch((fError) => console.error("Could not read plugin config", fError));


    function logPluginInfo() {
        let aC = fApi.getStoreData("nav.ais.updateCount");
        if (aC !== mLastUpdateCount) {
            if ((aC - mLastUpdateCount) > 1) {
                logInfo("logPluginInfo(): AIS update count jumped from " + mLastUpdateCount + " to " + aC);
            }
            mLastUpdateCount = aC;
//            logDebug("num positions: " + mTargetHistory.numPositions()
//              + ", num AIS targets: " + mTargetHistory.size() + ", AIS update count: " + aC);
        }   
    }

    const logTimer = window.setInterval(() => logPluginInfo(), 250);
    const cleanupTimer = window.setInterval(
        () => mTargetHistory.removeOldTargets(AisCpaWidget.HistoryTime * 60),
        1000 * 60
    );

    return () => {
        logInfo("plugin.mjs cleanup called");
        if (logTimer) window.clearInterval(logTimer);
        if (cleanupTimer) window.clearInterval(cleanupTimer);
    }
};