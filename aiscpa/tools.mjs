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

export function lineIntersectsCanvas(fStart, fEnd, fWidth, fHeight) {
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

export function drawCPA(fApi, fSelf, fCtx, fIsWarning, fOwnPos, fOwnSpeed, fOwnCourse, fTargetPos, fTargetSpeed, fTargetCourse, fTcpa, fTargetLength, fTargetWidth,
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
