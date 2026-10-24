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

export default async (api) => {

    // AVNAV: draws AIS CPA line on map display widget
    var AisCpaWidget = {
        name: "AisCpaWidget",
        type: "map",
        // Fordere einfach alles an, was dich interessiert
        storeKeys: {
            // see https://github.com/wellenvogel/avnav/blob/master/viewer/util/keys.ts
            aisList: 'nav.ais.list',
            aisUpdateCount: 'nav.ais.updateCount',
            position: 'nav.gps.position',
            course: 'nav.gps.course',
            speed: 'nav.gps.speed'
        },
        renderCanvas: function (canvas, props) {
            console.log("AisCpaWidget::renderCanvas() props = ", props);
            // quit if no data
            if (!props.position || !props.position.lat || !props.position.lon) {
                console.log("AisCpaWidget::renderCanvas() no own position", props);
                return;
            }

            var speed = props.speed;
            if (!speed) {
                speed = 0.0;
            }
            var course = props.course;
            if (!course) {
                course = 0.0;
            }

            var ctx = canvas.getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            console.log("AisCpaWidget::renderCanvas() aisUpdateCount = ", props.aisUpdateCount);

            for (const aisidx in props.aisList) {
                const ais = props.aisList[aisidx];
                if (ais.warning) {
                    console.log("AisCpaWidget::renderCanvas() ais warning for MMSI " + ais.mmsi + ", name " + ais.received.shipname);
                    console.log("AisCpaWidget::renderCanvas() ais = ", ais);

                    var targetSpeed = ais.received.speed;
                    if (!targetSpeed) {
                        targetSpeed = 0.0;
                    }
                    var targetCourse = ais.received.course;
                    if (!targetCourse) {
                        targetCourse = 0.0;
                    }

                    var targetData = ais.received;
                    if (ais.estimated && ais.estimated.lat && ais.estimated.lon) {
                        targetData = ais.estimated;
                    }

                    let LatLon = api.LatLon();
                    let aP1 = new LatLon(targetData.lat, targetData.lon);
                    let aP2 = aP1.destinationPoint(targetSpeed * ais.cpadata.tcpa, targetCourse);
                    var aTargetXY = this.lonLatToPixel(aP1.lon, aP1.lat);
                    var aTargetCPAXY = this.lonLatToPixel(aP2.lon, aP2.lat);
                    var aTargetCPAX = aTargetCPAXY[0];
                    var aTargetCPAY = aTargetCPAXY[1];

                    let aP3 = new LatLon(props.position.lat, props.position.lon);
                    let aP4 = aP3.destinationPoint(speed * ais.cpadata.tcpa, course);
                    var aOwnXY = this.lonLatToPixel(aP3.lon, aP3.lat);
                    var aOwnCPAXY = this.lonLatToPixel(aP4.lon, aP4.lat);
                    var aOwnCPAX = aOwnCPAXY[0];
                    var aOwnCPAY = aOwnCPAXY[1];


                    // draw CPA connection
                    ctx.beginPath();
                    ctx.strokeStyle = 'red';
                    ctx.setLineDash([2, 2]);
                    ctx.lineWidth = 3;

                    ctx.moveTo(aOwnCPAX, aOwnCPAY);
                    ctx.lineTo(aTargetCPAX, aTargetCPAY);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.lineWidth = 1;
                    ctx.moveTo(aOwnCPAX, aOwnCPAY);
                    ctx.lineTo(aOwnXY[0], aOwnXY[1]);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(aTargetCPAX, aTargetCPAY);
                    ctx.lineTo(aTargetXY[0], aTargetXY[1]);
                    ctx.stroke();

                    // draw circles for positions at TCPA
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = "black";
                    ctx.setLineDash([]);
                    ctx.fillStyle = 'yellow';
                    ctx.beginPath();
                    ctx.arc(aOwnCPAX, aOwnCPAY, 7, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(aTargetCPAX, aTargetCPAY, 7, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                }
            }

            ctx.restore();
            console.log("AisCpaWidget::renderCanvas() fini");
        }
    }


    api.registerWidget(AisCpaWidget);

    console.log("aiscpa plugin.mjs loaded")
    console.log("name", api.getPluginName());
    console.log("baseUrl", api.getBaseUrl());
    const cfg = await api.getConfig();
    console.log("plugin config", cfg);
    return () => {
        console.log("cleanup called for aiscpa plugin.mjs");
    }
};