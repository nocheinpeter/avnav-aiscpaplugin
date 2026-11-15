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

export default async (fApi) => {

    const mLogDebug = true; // set to false to disable debug logging
    const mModuleName = "aiscpa";
    const STOREKEYAISCPA = fApi.getStoreBaseKey() + ".AisCpa";
    fApi.setStoreData(STOREKEYAISCPA, true); // CPAs ares visible by default

    function logDebug(fMsg) {
        if (mLogDebug) {
            console.log(mModuleName + " " + new Date().toLocaleString() + " " + fMsg);
        }
    }

    function logInfo(fMsg) {
        console.log(mModuleName + " " + new Date().toLocaleString() +" " + fMsg);
    }

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


    // saves targets track history
    class TargetHistory {
        constructor() {
            this.historyByMmsi = new Map();
            this.positionCount = 0;
        }

        saveHistory(fMmsi, fPosition, fMaxHistoryTime) {

            if (fMaxHistoryTime <= 0) {
                this.clear();
                return { counter: 0, pos: [] };
            }

            const aNow = Date.now();
            const aOldestTime = aNow - fMaxHistoryTime * 60 * 1000;
            let aHistory = this.historyByMmsi.get(fMmsi);
            if (!aHistory) {
                aHistory = { counter: 0, pos: [] };
                this.historyByMmsi.set(fMmsi, aHistory);
            }

            this.removeExpiredPositions(fMmsi, aHistory, aOldestTime);
            
            if (typeof fPosition === 'undefined' || fPosition === null || typeof fPosition.lat === 'undefined' || typeof fPosition.lon === 'undefined') {
                return aHistory;
            }

            let aLastPos = aHistory.pos[aHistory.pos.length - 1];
            if (!aLastPos || aLastPos.lat !== fPosition.lat || aLastPos.lon !== fPosition.lon) {
                aHistory.pos.push({ lat: fPosition.lat, lon: fPosition.lon, timestamp: aNow });
                aHistory.counter += 1;
                this.positionCount += 1;
            }
            else {
                if (aLastPos) {
                    aLastPos.timestamp = aNow;
                }
            }
            return aHistory;
        }

        // clears all target histories
        clear() {
            console.log("TargetHistory::clear()");
            this.historyByMmsi.clear();
            this.positionCount = 0;
        }

        size() {
            return this.historyByMmsi.size;
        }

        numPositions() {
            return this.positionCount;
        }

        // removes all target histories older than fMaxAgeSeconds
        removeOldTargets(fMaxAgeSeconds) {
            if (fMaxAgeSeconds <= 0) {
                this.clear();
                return;
            }

            const aOldestTime = Date.now() - fMaxAgeSeconds * 1000;
            for (const [aMmsi, aHistory] of this.historyByMmsi) {
                const aLastPosition = aHistory.pos[aHistory.pos.length - 1];
                if (!aLastPosition || !Number.isFinite(aLastPosition.timestamp) || aLastPosition.timestamp < aOldestTime) {
                    this.positionCount -= aHistory.pos.length;
                    this.historyByMmsi.delete(aMmsi);
                    logInfo("TargetHistory::removeOldTargets() deleting history of " + aMmsi 
                        + ", last time = " + (aLastPosition ? new Date(aLastPosition.timestamp).toLocaleString() : "none")
                        + ", #positions = " + this.positionCount);
                }
            }
        }

        removeExpiredPositions(fMmsi, fHistory, fOldestTime) {
            //console.log("TargetHistory::removeExpiredPositions() called for mmsi " + fMmsi);
            while (fHistory.pos.length > 0
              && (!Number.isFinite(fHistory.pos[0].timestamp) || fHistory.pos[0].timestamp < fOldestTime)) {
          
                logInfo("TargetHistory::removeExpiredPositions() deleting old history for mmsi " + fMmsi
                        + ", timestamp = " + new Date(fHistory.pos[0].timestamp).toLocaleString());
          
                fHistory.pos.shift();
                this.positionCount -= 1;
            }
        }
    }

    var mTargetHistory = new TargetHistory();

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
                        const aHistory = mTargetHistory.saveHistory(aAis.mmsi, aAis.received, this.HistoryTime);

                        drawCPA(this, aCtx, aAis.warning, fProps.position, aSpeed, aCourse, aTargetData, aTargetSpeed, aTargetCourse,
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

    function lineIntersectsCanvas(fStart, fEnd, fWidth, fHeight) {
        const aX = fEnd[0] - fStart[0];
        const aY = fEnd[1] - fStart[1];
        const aP = [-aX, aX, -aY, aY];
        const aQ = [fStart[0], fWidth - fStart[0], fStart[1], fHeight - fStart[1]];
        let aMin = 0;
        let aMax = 1;

        if (![...fStart, ...fEnd, fWidth, fHeight].every(Number.isFinite)) {
            return false;
        }

        for (let i = 0; i < aP.length; i++) {
            if (aP[i] === 0) {
                if (aQ[i] < 0) {
                    return false;
                }
            }
            else {
                const aRatio = aQ[i] / aP[i];
                if (aP[i] < 0) {
                    if (aRatio > aMax) {
                        return false;
                    }
                    aMin = Math.max(aMin, aRatio);
                }
                else {
                    if (aRatio < aMin) {
                        return false;
                    }
                    aMax = Math.min(aMax, aRatio);
                }
            }
        }
        return true;
    }

    function drawCPA(fSelf, fCtx, fIsWarning, fOwnPos, fOwnSpeed, fOwnCourse, fTargetPos, fTargetSpeed, fTargetCourse, fTcpa, fTargetLength, fTargetWidth,
        fTargetToBow, fTargetToPort, fTargetHeading, fTargetHistory) {
        /*         console.log("AisCpaWidget::drawCPA() ownPos = ", ownPos, " ownSpeed = ", ownSpeed, " ownCourse = ", ownCourse);
                console.log("AisCpaWidget::drawCPA() targetPos = ", targetPos, " targetSpeed = ", targetSpeed, " targetCourse = ", targetCourse);
                console.log("AisCpaWidget::drawCPA() tcpa = ", tcpa);   
         */
        let aLatLon = fApi.LatLon();
        let aP1 = new aLatLon(fTargetPos.lat, fTargetPos.lon);
        var aTargetXY = fSelf.lonLatToPixel(aP1.lon, aP1.lat);

        // Rec. ITU-R M.1371-4 3.3.3 Reference point for reported position and overall dimensions of ship
        let aIsAntennaPosValid = (typeof fTargetToPort !== 'undefined') && (typeof fTargetToBow !== 'undefined')
          && (typeof fTargetLength !== 'undefined') && (typeof fTargetWidth !== 'undefined');
        aIsAntennaPosValid = aIsAntennaPosValid && (fTargetToPort !== null) && (fTargetToBow !== null) && (fTargetLength !== null) && (fTargetWidth !== null);
        aIsAntennaPosValid = aIsAntennaPosValid && ((fTargetToPort > 0) || (fTargetToBow > 0));

        //
        // draw real target size
        //
        if (fSelf.CPADrawRealSize && aIsAntennaPosValid
          && aTargetXY[0] >= 0 && aTargetXY[1] >= 0 && aTargetXY[0] <= fCtx.canvas.width && aTargetXY[1] <= fCtx.canvas.height) {
            if (typeof fTargetHeading === 'undefined' || fTargetHeading === null) {
                fTargetHeading = fTargetCourse;
            }
            // target shape with smaller bow
            let aToPort = fTargetToPort;
            let aToStern = fTargetLength - fTargetToBow;

            let aStern = aP1.destinationPoint(aToStern, fTargetHeading + 180.0);
            let aSternPort = aStern.destinationPoint(aToPort, fTargetHeading - 90.0);
            let aSternMiddle = aSternPort.destinationPoint(fTargetWidth / 2.0, fTargetHeading + 90.0);
            let aPort = aSternPort.destinationPoint(0.9 * fTargetLength, fTargetHeading);
            let aBowMiddle = aSternMiddle.destinationPoint(fTargetLength, fTargetHeading);
            let aStarboard = aPort.destinationPoint(fTargetWidth, fTargetHeading + 90.0);
            let aSternStarboard = aSternPort.destinationPoint(fTargetWidth, fTargetHeading + 90.0);

            var aTargetRectXY = [
                fSelf.lonLatToPixel(aSternPort.lon, aSternPort.lat),
                fSelf.lonLatToPixel(aPort.lon, aPort.lat),
                fSelf.lonLatToPixel(aBowMiddle.lon, aBowMiddle.lat),
                fSelf.lonLatToPixel(aStarboard.lon, aStarboard.lat),
                fSelf.lonLatToPixel(aSternStarboard.lon, aSternStarboard.lat)
            ];
            fCtx.globalAlpha = 1.0; // fixes transparency
            fCtx.beginPath();
            fCtx.strokeStyle = '#303030';
            fCtx.fillStyle = '#ff000020';
            fCtx.lineWidth = 1;
            fCtx.moveTo(aTargetRectXY[0][0], aTargetRectXY[0][1]);
            fCtx.lineTo(aTargetRectXY[1][0], aTargetRectXY[1][1]);
            fCtx.lineTo(aTargetRectXY[2][0], aTargetRectXY[2][1]);
            fCtx.lineTo(aTargetRectXY[3][0], aTargetRectXY[3][1]);
            fCtx.lineTo(aTargetRectXY[4][0], aTargetRectXY[4][1]);
            fCtx.closePath();
            fCtx.stroke();
            fCtx.fill();
        }

        //
        // draw target history if target is visible or if the oldest history point line to target intersects the canvas
        //
        let aOldestHistoryXY;
        if (fTargetHistory.length > 0) {
            let aOldestHistoryPos = fTargetHistory[0];
            let aOldestHistoryLatLon = new aLatLon(aOldestHistoryPos.lat, aOldestHistoryPos.lon);
            aOldestHistoryXY = fSelf.lonLatToPixel(aOldestHistoryLatLon.lon, aOldestHistoryLatLon.lat);
        }
        let aIsTargetVisible = aTargetXY[0] >= 0 && aTargetXY[1] >= 0
          && aTargetXY[0] <= fCtx.canvas.width && aTargetXY[1] <= fCtx.canvas.height;
        let aIsLastHistoryLineVisible = aOldestHistoryXY
          && lineIntersectsCanvas(aOldestHistoryXY, aTargetXY, fCtx.canvas.width, fCtx.canvas.height);
        if (aIsTargetVisible || aIsLastHistoryLineVisible) {

            fCtx.lineWidth = fSelf.HistoryLineWidth;
            fCtx.strokeStyle = fSelf.HistoryColor;
            fCtx.beginPath();
            let aFirst = true;
            for (const aPos of fTargetHistory) {
                let aP = new aLatLon(aPos.lat, aPos.lon);
                var aTargetHistoryXY = fSelf.lonLatToPixel(aP.lon, aP.lat);
                if (aFirst) {
                    fCtx.moveTo(aTargetHistoryXY[0], aTargetHistoryXY[1]);
                    aFirst = false;
                } else {
                    fCtx.lineTo(aTargetHistoryXY[0], aTargetHistoryXY[1]);
                }   
            }
            fCtx.stroke();
            fCtx.lineWidth = 1;
            for (let i = 0; i < fTargetHistory.length - 1; i++) {
                let aPos = fTargetHistory[i];
                let aP = new aLatLon(aPos.lat, aPos.lon);   
                var aTargetHistoryXY = fSelf.lonLatToPixel(aP.lon, aP.lat);
                fCtx.beginPath();
                fCtx.arc(aTargetHistoryXY[0], aTargetHistoryXY[1], fSelf.HistoryLineWidth, 0, 2 * Math.PI);
                fCtx.fillStyle = fSelf.HistoryColor;
                fCtx.fill();
                fCtx.stroke();
            }
        }

        if (typeof fOwnPos === 'undefined' || fOwnPos === null || typeof fOwnPos.lat === 'undefined'
          || typeof fOwnPos.lon === 'undefined') {
            return; // quit if no data
        }

        //
        // draw CPA for warning targets
        //
        if (fIsWarning) {
            let aP2 = aP1.destinationPoint(fTargetSpeed * fTcpa, fTargetCourse);
            var aTargetCPAXY = fSelf.lonLatToPixel(aP2.lon, aP2.lat);
            let aP3 = new aLatLon(fOwnPos.lat, fOwnPos.lon);
            let aP4 = aP3.destinationPoint(fOwnSpeed * fTcpa, fOwnCourse);
            var aOwnXY = fSelf.lonLatToPixel(aP3.lon, aP3.lat);
            var aOwnCPAXY = fSelf.lonLatToPixel(aP4.lon, aP4.lat);

            fCtx.globalAlpha = fSelf.CPAOpacity;
            // draw CPA connection
            fCtx.beginPath();
            fCtx.strokeStyle = fSelf.CPAFillColor;
            fCtx.lineWidth = fSelf.CPALineWidth;
            fCtx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
            fCtx.lineTo(aTargetCPAXY[0], aTargetCPAXY[1]);
            fCtx.stroke();

            fCtx.beginPath();
            fCtx.strokeStyle = fSelf.CPALineColor;
            fCtx.setLineDash([10, 6]);
            fCtx.lineWidth = fSelf.CPALineWidth;
            fCtx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
            fCtx.lineTo(aTargetCPAXY[0], aTargetCPAXY[1]);
            fCtx.stroke();

            // draw lines from current positions to positions at TCPA
            fCtx.beginPath();
            fCtx.strokeStyle = fSelf.CPACourseColor;
            //ctx.setLineDash([1, 1]);
            fCtx.lineWidth = 1;
            fCtx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
            fCtx.lineTo(aOwnXY[0], aOwnXY[1]);
            fCtx.stroke();

            fCtx.beginPath();
            fCtx.moveTo(aTargetCPAXY[0], aTargetCPAXY[1]);
            fCtx.lineTo(aTargetXY[0], aTargetXY[1]);
            fCtx.stroke();

            // draw circles for positions at TCPA
            fCtx.lineWidth = fSelf.CPAStrokeWidthCircle;
            fCtx.strokeStyle = fSelf.CPAStrokeColorCircle;
            fCtx.setLineDash([]);
            fCtx.fillStyle = fSelf.CPAFillColor;
            fCtx.beginPath();
            fCtx.arc(aOwnCPAXY[0], aOwnCPAXY[1], fSelf.CPACircleRadius, 0, 2 * Math.PI);
            fCtx.fill();
            fCtx.stroke();

            if (fTargetSpeed > 0.0) {
                fCtx.beginPath();
                fCtx.arc(aTargetCPAXY[0], aTargetCPAXY[1], fSelf.CPACircleRadius, 0, 2 * Math.PI);
                fCtx.fill();
                fCtx.stroke();
            }
        }
    }

    logInfo("aiscpa plugin.mjs check version");
    logInfo("AvNav version: ", fApi.getAvNavVersion());
    if (fApi.getAvNavVersion() < 20261019) {
        logInfo("AIS CPA plugin requires AVNav version 20261019 or higher, please update your AVNav installation");
        fApi.showToast("AIS CPA plugin requires AVNav version 20261019 or higher, please update your AVNav installation");
        return;
    }

    fApi.registerWidget(AisCpaWidget, AisCpaParameter);
    console.log("aiscpa plugin.mjs registerWidget(AisCpaWidget, AisCpaParameter) done");

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
    logInfo("name", fApi.getPluginName());
    logInfo("baseUrl", fApi.getBaseUrl());
    const aCfg = await fApi.getConfig();
    logInfo("plugin config", aCfg);

    function logPluginInfo() {
        logDebug("num positions: " + mTargetHistory.numPositions()
            + ", num AIS targets: " + mTargetHistory.size());
    }

    const logTimer = window.setInterval(() => logPluginInfo(), 1000 * 30);
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