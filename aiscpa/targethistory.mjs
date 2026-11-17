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

 export default class TargetHistory {
    constructor(fLog = (...fArgs) => console.log(...fArgs)) {
        this.log = fLog;
        this.historyByMmsi = new Map();
        this.positionCount = 0;
        this.log("TargetHistory::constructor()");
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
        else if (aLastPos) {
            aLastPos.timestamp = aNow;
        }
        return aHistory;
    }

    clear() {
        this.log("TargetHistory::clear()");
        this.historyByMmsi.clear();
        this.positionCount = 0;
    }

    size() {
        return this.historyByMmsi.size;
    }

    numPositions() {
        return this.positionCount;
    }

    removeOldTargets(fMaxAgeSeconds) {
        if (fMaxAgeSeconds <= 0) {
            this.clear();
            return;
        }

        let aNumOldPositions = 0;
        let aNumOldTargets = 0;
        const aOldestTime = Date.now() - fMaxAgeSeconds * 1000;
        for (const [aMmsi, aHistory] of this.historyByMmsi) {
            const aLastPosition = aHistory.pos[aHistory.pos.length - 1];
            if (!aLastPosition || !Number.isFinite(aLastPosition.timestamp) || aLastPosition.timestamp < aOldestTime) {
                this.positionCount -= aHistory.pos.length;
                this.historyByMmsi.delete(aMmsi);
//                this.log("TargetHistory::removeOldTargets() deleting history of " + aMmsi
//                    + ", last time = " + (aLastPosition ? new Date(aLastPosition.timestamp).toLocaleString() : "none")
//                    + ", #points =" + aHistory.pos.length
//                    + ", #positions = " + this.positionCount);
                aNumOldTargets += 1;
                aNumOldPositions += aHistory.pos.length;
            }
        }
        if (aNumOldTargets > 0) {
            this.log("TargetHistory::removeOldTargets() deleted history of #mmsi " + aNumOldTargets
                + ", and deleted #points =" + aNumOldPositions);
        }
    }

    removeExpiredPositions(fMmsi, fHistory, fOldestTime) {
        let aCounter = 0;
        while (fHistory.pos.length > 0
          && (!Number.isFinite(fHistory.pos[0].timestamp) || fHistory.pos[0].timestamp < fOldestTime)) 
        {
            fHistory.pos.shift();
            this.positionCount -= 1;
            aCounter += 1;
        }
        
//        if (aCounter > 0) {
//            this.log("TargetHistory::removeExpiredPositions() deleted " + aCounter + " old positions for mmsi " + fMmsi
//                + ", #positions = " + this.positionCount);
//        }
    }
}
