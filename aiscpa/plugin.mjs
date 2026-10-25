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
        }
    };

    var AisCpaWidget = {
        // Editable Parameters
        Opacity: 1.0,
        CircleRadius: 7,
        FillColor: 'yellow',
        LineColor: 'red',
        LineWidth: 4,
        StrokeWidthCircle: 1,
        StrokeColorCircle: 'black',

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
            navCircleColor: 'properties.navCircleColor'

        },
        initFunction: function (canvas, props) {
            this.CPAOpacity = props.Opacity;
            this.CPAStrokeWidthCircle = props.StrokeWidthCircle;
            this.CPAFillColor = props.FillColor;
            this.CPACircleRadius = props.CircleRadius;
            this.CPALineColor = props.LineColor;
            this.CPALineWidth = props.LineWidth;
            this.CPAStrokeColorCircle = props.StrokeColorCircle;
            this.CPACourseColor = props.navCircleColor;
        },
        renderCanvas: function (canvas, props) {
            //console.log("AisCpaWidget::renderCanvas() props = ", props);
            // quit if no data
            if (!props.position || !props.position.lat || !props.position.lon) {
                //console.log("AisCpaWidget::renderCanvas() no own position", props);
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

            //console.log("AisCpaWidget::renderCanvas() aisUpdateCount = ", props.aisUpdateCount);

            for (const aisidx in props.aisList) {
                const ais = props.aisList[aisidx];
                if (ais.warning) {
                    console.log("AisCpaWidget::renderCanvas() ais warning for MMSI " + ais.mmsi + ", name " + ais.received.shipname);
                    //console.log("AisCpaWidget::renderCanvas() ais = ", ais);

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

                    drawCPA(this, ctx, props.position, speed, course, targetData, targetSpeed, targetCourse, ais.cpadata.tcpa);
                }
            }

            ctx.restore();
            //console.log("AisCpaWidget::renderCanvas() fini");
        }
    }

    function drawCPA(self, ctx, ownPos, ownSpeed, ownCourse, targetPos, targetSpeed, targetCourse, tcpa) {
        /*         console.log("AisCpaWidget::drawCPA() ownPos = ", ownPos, " ownSpeed = ", ownSpeed, " ownCourse = ", ownCourse);
                console.log("AisCpaWidget::drawCPA() targetPos = ", targetPos, " targetSpeed = ", targetSpeed, " targetCourse = ", targetCourse);
                console.log("AisCpaWidget::drawCPA() tcpa = ", tcpa);
         */
        let LatLon = api.LatLon();
        let aP1 = new LatLon(targetPos.lat, targetPos.lon);
        let aP2 = aP1.destinationPoint(targetSpeed * tcpa, targetCourse);
        var aTargetXY = self.lonLatToPixel(aP1.lon, aP1.lat);
        var aTargetCPAXY = self.lonLatToPixel(aP2.lon, aP2.lat);

        let aP3 = new LatLon(ownPos.lat, ownPos.lon);
        let aP4 = aP3.destinationPoint(ownSpeed * tcpa, ownCourse);
        var aOwnXY = self.lonLatToPixel(aP3.lon, aP3.lat);
        var aOwnCPAXY = self.lonLatToPixel(aP4.lon, aP4.lat);

        // draw CPA connection
        ctx.globalAlpha = self.CPAOpacity;
        ctx.beginPath();
        ctx.strokeStyle = self.CPAFillColor;
        ctx.lineWidth = self.CPALineWidth;
        ctx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
        ctx.lineTo(aTargetCPAXY[0], aTargetCPAXY[1]);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = self.CPALineColor;
        ctx.setLineDash([10, 6]);
        ctx.lineWidth = self.CPALineWidth;
        ctx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
        ctx.lineTo(aTargetCPAXY[0], aTargetCPAXY[1]);
        ctx.stroke();

        // draw lines from current positions to positions at TCPA
        ctx.beginPath();
        ctx.strokeStyle = self.CPACourseColor;
        //ctx.setLineDash([1, 1]);
        ctx.lineWidth = 1;
        ctx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
        ctx.lineTo(aOwnXY[0], aOwnXY[1]);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(aTargetCPAXY[0], aTargetCPAXY[1]);
        ctx.lineTo(aTargetXY[0], aTargetXY[1]);
        ctx.stroke();

        // draw circles for positions at TCPA
        ctx.lineWidth = self.CPAStrokeWidthCircle;
        ctx.strokeStyle = self.CPAStrokeColorCircle;
        ctx.setLineDash([]);
        ctx.fillStyle = self.CPAFillColor;
        ctx.beginPath();
        ctx.arc(aOwnCPAXY[0], aOwnCPAXY[1], self.CPACircleRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        if (targetSpeed > 0.0) {
            ctx.beginPath();
            ctx.arc(aTargetCPAXY[0], aTargetCPAXY[1], self.CPACircleRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }
    }

    api.registerWidget(AisCpaWidget, AisCpaParameter);

    console.log("aiscpa plugin.mjs loaded")
    console.log("name", api.getPluginName());
    console.log("baseUrl", api.getBaseUrl());
    const cfg = await api.getConfig();
    console.log("plugin config", cfg);
    return () => {
        console.log("cleanup called for aiscpa plugin.mjs");
    }
};