class candleStick {

    // Function that rounds float to given precision and returns rounded float
    roundFloat(number) { return parseFloat(number.toFixed(this.yPrec)); }

    // Function that replaces datetime strings in data array for moment objects 
    parseDates(data) {
        if (data.length && 'Date' in data[0]) {
            for (let i = 0; i <= data.length-1; i++) { data[i].Date = moment.utc(data[i].Date, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]'); }
            return data;
        } else if (data.length && 'startDt' in data[0]) {
            for (let i = 0; i <= data.length-1; i++) { data[i].startDt = moment.utc(data[i].startDt, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
                                                       data[i].stopDt = moment.utc(data[i].stopDt, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]'); }
            return data;
        } else { return data; }
    }
    
    // Function that creates dt array from data
    createDtArray() {
        this.dtArray = this.priceArray.map(function(d){return d.Date;});
    }

    // Function that returns middle date object from array of dates
    getAverDate(startInd, endInd) {
        var arraySlice = this.dtArray.slice(startInd, endInd);
        this.averDate = arraySlice[Math.floor(arraySlice.length / 2)];
    }

    // Function that returns formatted date for x axis title
    dateFormatter(dt) {
        var date = (dt.date() < 10 ? '0' : '') + dt.date();
        var month = ((dt.month()+1) < 10 ? '0' : '') + (dt.month()+1);
        var year = dt.year();
        return date + '.' + month + '.' + year;
    }

    // Function that creates array of x axis ticks
    createXTicks(startInd, stopInd) {
        // delete previous array content
        this.xTicksArray = [];
        
        // find first datetime with full hour
        var fullHourInd = startInd;
        for (let i = startInd; i < stopInd-1; i++) {
            if (this.dtArray[i].minute() === 0) { break; }
            fullHourInd += 1;
        }

        // create ticks left from full hour dt
        var noLabelCount = 1;
        for (let i = fullHourInd-1; i >= startInd; i--) {
            if (noLabelCount === this.xStep) { this.xTicksArray.push(this.dtArray[i]); noLabelCount = 1; }
            else { noLabelCount += 1; }
        }

        // create ticks right from full hour dt
        var noLabelCount = this.xStep;
        for (let i = fullHourInd; i < stopInd-1; i++) {
            if (noLabelCount === this.xStep) { this.xTicksArray.push(this.dtArray[i]); noLabelCount = 1; }
            else { noLabelCount += 1; }
        }
        
        // sort resulting array
        this.xTicksArray.sort((a, b) => a - b);
    }
    
    // Function that returns formatted x values based on provided x ticks
    xValuesFormatter(dt) { return dt.format('HH:mm'); }

    // Function that calculates limits of y axis so that its length is equal to yRange and data is centered
    getYLimits(dtArrayStart, dtArrayEnd) {
        var ohlcArray = [];
        for(let i = dtArrayStart; i < dtArrayEnd; i++){
            ohlcArray.push(parseFloat(this.priceArray[i].Open), parseFloat(this.priceArray[i].High), parseFloat(this.priceArray[i].Low), parseFloat(this.priceArray[i].Close));
        }
        var middlePrice = (d3.max(ohlcArray) - d3.min(ohlcArray))/2 + d3.min(ohlcArray);
        this.yLimitArray = [this.roundFloat(middlePrice - this.yRange/2), this.roundFloat(middlePrice + this.yRange/2)];
    }

    // Function that creates array with y ticks
    createYTicks() {
        var labelsArray = [];
        for (let i = this.yLimitArray[0]; i <= this.yLimitArray[1]; i += this.yStep) {
            labelsArray.push(this.roundFloat(i));
        }
        this.yTicksArray = labelsArray;
    }

    // Function that returns slice of price array with removed missing candles
    filterPriceArray(startInd, stopInd) {
        var array = this.priceArray.slice(startInd, stopInd);
        return array.filter((row) => { return row.Open != null;});
    }

    // Function that draws candles and stems with data given by current data pointer
    drawCandlesAndStems() {
    
        d3.select("#candles").selectAll("rect").remove();
        this.candles.selectAll("rect")
            .data(this.filterPriceArray(this.dataPointer-this.noCandles, this.dataPointer))
            .enter().append("rect").attr("class", d => (d.Open <= d.Close) ? "candleUp" : "candleDown")
                                   .attr('x', d => this.xScale(d.Date))
                                   .attr('y', d => this.yScale(Math.max(d.Open, d.Close)))
                                   .attr('width', this.xScale.bandwidth())
                                   .attr('height', d => (d.Open === d.Close) ? 1 : this.yScale(Math.min(d.Open, d.Close)) - this.yScale(Math.max(d.Open, d.Close)))
                                   .attr("clip-path", "url(#clip)");

        d3.select("#stems").selectAll("line").remove();
        this.stems.selectAll("line").data(this.filterPriceArray(this.dataPointer-this.noCandles, this.dataPointer))
                  .enter().append("line").attr("class", d => (d.Open <= d.Close) ? "stemUp" : "stemDown")
                                         .attr("x1", d => this.xScale(d.Date) + this.xScale.bandwidth()/2)
                                         .attr("x2", d => this.xScale(d.Date) + this.xScale.bandwidth()/2)
                                         .attr("y1", d => this.yScale(d.High))
                                         .attr("y2", d => this.yScale(d.Low))
                                         .attr("clip-path", "url(#clip)");
    }

    // Function that calculates how many candles are translated from d3.event.transform object
    // Positive value means left shift
    // Negative value means right shift
    calcNoCandlesTranslated(transform) {
        var noTransCandles = Math.floor((this.noCandles/this.w) * transform.x);
        this.dataPointer -= noTransCandles - this.noPrevTransCandles;
        this.noPrevTransCandles = noTransCandles;
    }

    // Function that renders weekend line when data from two weeks exist
    drawWeekendLine(startInd, stopInd) {

        // find start-of-week date if exists
        var weekStartDt = null;
        for (let i = startInd; i < stopInd-1; i++) {
            if (this.dtArray[i+1].date() - this.dtArray[i].date() > 1) { weekStartDt = this.dtArray[i+1]; break; }
        }
        
        // draw weekend line if weekStartDt exists, remove it otherwise
        d3.select("line.weekendLine").remove();
        if (weekStartDt) {
            this.chartBody.append("line").attr("class", "weekendLine")
                                         .attr("x1", this.xScale(weekStartDt) - this.xBand.bandwidth()/2)
                                         .attr("y1", 0)
                                         .attr("x2", this.xScale(weekStartDt) - this.xBand.bandwidth()/2)
                                         .attr("y2", this.h);
        }
    }
    
    // Function that draws existing patterns in current timeframe
    drawExistingPatterns(startInd, stopInd) {

        // find visible patterns
        var startDt = this.priceArray[startInd].Date;
        var stopDt = this.priceArray[stopInd].Date;
        var visPatIndArray = [];
        for (let i = 0; i < this.patternArray.length; i++) {
            if (this.patternArray[i].startDt.isBetween(startDt, stopDt, null, '()') || this.patternArray[i].stopDt.isBetween(startDt, stopDt, null, '()')) { visPatIndArray.push(i); }
        }
        
        // draw visible patterns
        d3.selectAll("rect.bullPattern").remove();
        d3.selectAll("rect.bearPattern").remove();
        var rectClassDict = {'1': 'bullPattern', '-1': 'bearPattern'};
        for (let i = 0; i < visPatIndArray.length; i++) {
            let x;
            if (this.xScale(this.patternArray[visPatIndArray[i]].startDt)) {
                x = this.xScale(this.patternArray[visPatIndArray[i]].startDt) - this.xScale.step()*this.xScale.padding()/2;
            } else { x = 0; }
            let width;
            if(this.xScale(this.patternArray[visPatIndArray[i]].stopDt)) {
                width = this.xScale(this.patternArray[visPatIndArray[i]].stopDt) - x + this.xScale.bandwidth() + this.xScale.step()*this.xScale.padding()/2;
            } else { width = this.w; }
            this.chartBody.append("rect").attr("class", rectClassDict[this.patternArray[visPatIndArray[i]].dir])
                                         .attr("x", x)
                                         .attr("y", 0)
                                         .attr("width", width)
                                         .attr("height", this.h);
        }
    }
    
    // Function that applies logic for toggling between pattern drawing and panning
    togglePatternCreation(dir) {
        // In case of active pattern creation and click on same button
        if (this.isCreatingNewPattern && dir === this.newPatternDir) { 
            this.isCreatingNewPattern = !this.isCreatingNewPattern;
            // Inactivate pattern creation
            this.inactivatePatternCreation();
            // Activate panning
            this.svg.call(this.zoom);
            return;
        } 
        // In case of active pattern creation and click on another button
        else if (this.isCreatingNewPattern && dir !== this.newPatternDir) {
            // Change pattern direction
            this.newPatternDir = dir;
            // Activate pattern creation
            //this.activatePatternCreation();
            return;
        }
        // In case of inactive pattern creation
        else if (!this.isCreatingNewPattern) {
            this.isCreatingNewPattern = !this.isCreatingNewPattern;
            this.newPatternDir = dir;
            // Inactivate panning
            this.svg.on('.zoom', null);
            // Activate pattern creation
            this.activatePatternCreation();
            return;
        }
    }

    // Function that calculates clicked candle from d3.mouse coordinates and returns candle index in dtArray
    calculateClickedCandle(coord) {
        return this.dataPointer - this.noCandles + Math.floor((coord[0] - this.xScale.step()*this.xScale.padding()/2)/this.xScale.step());
    }

    // Function that shows window confirming new pattern and handles pattern saving, reloading
    confirmNewPattern(rect, startInd, stopInd, dir) {
        var startDt = this.dtArray[startInd];
        var stopDt = this.dtArray[stopInd];
        bootbox.confirm("Confirm new pattern at "+startDt.format("DD.MM.YYYY")+" between "+startDt.format("HH:mm")+" and "+stopDt.format("HH:mm")+" ?", (result) => { 
            if (result === true) { 
                // Save new pattern
                serverRequest('savePattern', 'create', createMessageForPatternSave(startDt, stopDt, dir)).then(() => {
                    rect.remove();
                    // Reload pattern array
                    serverRequest('loadPatterns', 'create', null).then((data) => {
                        data = this.parseDates(data);
                        this.patternArray = data;
                        // Redraw patterns
                        this.drawExistingPatterns(this.dataPointer-this.noCandles, this.dataPointer);
                        // inactivate pattern creation
                        this.isCreatingNewPattern = !this.isCreatingNewPattern;
                        this.inactivatePatternCreation();
                        this.svg.call(this.zoom);
                    });
                });
            } else { rect.remove(); }
        }); 
    }

    // Function that registers mouse events needed for drawing new patterns
    activatePatternCreation(dir) {
       
        var drawing = false;
        var startInd, stopInd;
        var x1, x2;
        var bandwidth = this.xScale.bandwidth();
        var padding = this.xScale.step()*this.xScale.padding();
        var rectClassDict = {"1": "bullPattern", "-1": "bearPattern"};
        var rect;

        this.chartBody.on('mousedown', (d, i, nodes) => {
            drawing = true;
            // calculate index of clicked candle
            startInd = this.calculateClickedCandle(d3.mouse(nodes[i]));
            x1 = this.xScale(this.dtArray[startInd]) + bandwidth/2
            rect = this.chartBody.append("rect").attr("class", rectClassDict[this.newPatternDir])
                                                .attr("y", 0)
                                                .attr("height", this.h);
            });

        this.chartBody.on('mousemove', (d, i, nodes) => { 
            if (drawing) {
                x2 = d3.mouse(nodes[i])[0];
                if (x2 >= x1) {
                    rect.attr("x", x1 - bandwidth/2 - padding/2)
                        .attr("width", x2 - x1 + bandwidth/2 + padding/2);
                } else if (x2 < x1) {
                    rect.attr("x", x2)
                        .attr("width", x1 + bandwidth/2 + padding/2 - x2);
                }
            }
        });

        this.chartBody.on('mouseup', (d, i, nodes) => {
            stopInd = this.calculateClickedCandle(d3.mouse(nodes[i]));
            x2 = this.xScale(this.dtArray[stopInd]) + bandwidth/2;
            if (x2 >= x1) {
                rect.attr("x", x1 - bandwidth/2 - padding/2)
                    .attr("width", x2 - x1 + bandwidth + padding);
                this.confirmNewPattern(rect, startInd, stopInd, this.newPatternDir);
            } else if (x2 < x1) {
                rect.attr("x", x2 - bandwidth/2 - padding/2)
                    .attr("width", x1 - x2 + bandwidth + padding);
                this.confirmNewPattern(rect, stopInd, startInd, this.newPatternDir);
            }
            drawing = false;
        });
    }

    // Function that removes mouse events needed for drawing new patterns
    inactivatePatternCreation() {
        this.chartBody.on('mousedown', null);
        this.chartBody.on('mousemove', null);
        this.chartBody.on('mouseup', null);
    }

    // Function that checks whether it is necessary to load new data
    // Loads news data if necessary
    // Returns correct noCandlesTrans
    checkAvailData() {
        
        return new Promise((resolve, reject) => {
            // check if it is necessary to load new data
            if (this.dataPointer-this.noCandles < 0) {
                var dir = 'left';
                var message = createMessageForDataLoad(this.dtArray[0], dir);
                console.log('reached left limit of array');
            } else if (this.dataPointer > this.priceArray.length-1) {
                var dir = 'right';
                var message = createMessageForDataLoad(this.dtArray.slice(-1)[0], dir);
                console.log('reached right limit of array');
            } else { return resolve(); }
            console.log('continuing to serverRequest'); 
            // load new data if necessary
            this.isLoadingData = true;
            serverRequest('loadNewData', 'create', message).then((data) => {
                if (dir === 'left') { 
                    this.dataPointer += data.length;
                    data = this.parseDates(data);
                    this.priceArray = data.concat(this.priceArray);
                    this.createDtArray();
                } else if (dir === 'right') {
                    data = this.parseDates(data);
                    this.priceArray = this.priceArray.concat(data);
                    this.createDtArray();
                }
                console.log('priceArray', this.priceArray);
                console.log('dtArray', this.dtArray);
                return resolve();
            });
        });
    }

    // define what should be re-rendered during zoom event
    pan() {
        
        if (this.isLoadingData) { return; }

        // calculate number of candles translated from transform event
        this.calcNoCandlesTranslated(d3.event.transform);
        
        // check if data is available for given translation
        this.checkAvailData().then(() => {
            
            // update x scale
            //this.xScale = d3.scalePoint().domain(this.dtArray.slice(this.dataPointer-this.noCandles, this.dataPointer)).range([0, this.w]);
            this.xScale.domain(this.dtArray.slice(this.dataPointer-this.noCandles, this.dataPointer));
            
            // create new x ticks
            this.createXTicks(this.dataPointer-this.noCandles, this.dataPointer);
            
            // update x axis
            this.gX.call(this.xAxis.scale(this.xScale).tickValues(this.xTicksArray));

            // update x grid
            this.gGX.call(this.xGrid.scale(this.xScale).tickValues(this.xTicksArray));
            
            // get limits of y axis
            this.getYLimits(this.dataPointer-this.noCandles, this.dataPointer);

            // get value of y ticks
            this.createYTicks();

            // update yScale
            this.yScale = d3.scaleLinear().domain([this.yLimitArray[0], this.yLimitArray[1]]).range([this.h, 0]);

            // update yAxis
            this.gY.call(this.yAxis.scale(this.yScale).tickValues(this.yTicksArray));

            // update yGrid
            this.gGY.call(this.yGrid.scale(this.yScale).tickValues(this.yTicksArray));
            
            // calculate most common date
            this.getAverDate(this.dataPointer-this.noCandles, this.dataPointer);

            // update x title
            this.xTitle.text(this.dateFormatter(this.averDate));

            // update candles and stems
            this.drawCandlesAndStems();

            // draw weekend line if necessary
            this.drawWeekendLine(this.dataPointer-this.noCandles, this.dataPointer);
            
            // draw existing patterns
            this.drawExistingPatterns(this.dataPointer-this.noCandles, this.dataPointer);

            this.isLoadingData = false;
        });
    }

    // Function that process initial data
    processData(dataLeft, dataRight) {

        return new Promise((resolve, reject) => {
            
            this.dataPointer = dataLeft.length;

            // Parse dates to moment objects
            dataLeft = this.parseDates(dataLeft);
            dataRight = this.parseDates(dataRight);
            
            // create price array from data
            this.priceArray = dataLeft.concat(dataRight);
            
            // get array of dates from data
            this.createDtArray();

            // calculate most common date for x axis title
            this.getAverDate(this.dataPointer - this.noCandles, this.dataPointer);
            
            // define linear x-axis scale for positioning of candles
            // inital scale displays noCandles of most recent candles
            //this.xScale = d3.scalePoint().domain(this.dtArray.slice(this.dataPointer-this.noCandles, this.dataPointer)).range([0, this.w]);
            this.xScale = d3.scaleBand().domain(this.dtArray.slice(this.dataPointer-this.noCandles, this.dataPointer)).range([0, this.w]).padding(0.3);

            // define banded x-axis scale to account for padding between candles
            // band scale accounts for padding between candles; range consists of x positions of candles
            this.xBand = d3.scaleBand().domain(d3.range(this.dataPointer-this.noCandles, this.dataPointer)).range([0, this.w]).padding(0.3);
            
            // create array with x ticks
            this.createXTicks(this.dataPointer-this.noCandles, this.dataPointer);

            // get initial limits of y axis
            this.getYLimits(this.dataPointer-this.noCandles, this.dataPointer);
            
            // create array with y labels
            this.createYTicks();
            
            // define linear y-axis scale
            this.yScale = d3.scaleLinear().domain([this.yLimitArray[0], this.yLimitArray[1]]).range([this.h, 0]);
            
            // define x-axis, apply scale and tick formatting
            //this.xAxis = d3.axisBottom().scale(this.xScale).ticks(d3.timeMinute.every(this.xStep)).tickFormat(this.timeFormatter);
            this.xAxis = d3.axisBottom().scale(this.xScale).tickValues(this.xTicksArray).tickFormat(this.xValuesFormatter);

            // define y-axis, apply scale and define label values and precision
            this.yAxis = d3.axisLeft().scale(this.yScale).tickValues(this.yTicksArray).tickFormat(d3.format("."+this.yPrec+"f"));
            
            // Define x gridlines
            this.xGrid = d3.axisBottom().scale(this.xScale).tickValues(this.xTicksArray).tickFormat("").tickSize(this.h);
            
            // Define y gridlines
            this.yGrid = d3.axisLeft().scale(this.yScale).tickValues(this.yTicksArray).tickFormat("").tickSize(-this.w);

            // load pattern array
            serverRequest('loadPatterns', 'create', null).then((data) => {data = this.parseDates(data); this.patternArray = data; return resolve();});
        });
    }

    drawChart() {
    
        // create clip path that hides clipped elements outside of it
        this.svg.append("defs").append("clipPath").attr("id", "clip")
                               .append("rect").attr("width", this.w)
                                              .attr("height", this.h);

        // define chart dimensions
        this.focus = this.svg.append("g").attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        // Draw inner frame
        this.focus.append("rect").attr("id", "innerFrame")
                                 .attr("width", this.w)
                                 .attr("height", this.h)
                                 .style("pointer-events", "all")
                                 .attr("clip-path", "url(#clip)");
        
        // add clip-path to chart body
        this.chartBody = this.focus.append("g").attr("class", "chartBody")
                                               .style("pointer-events", "all")
                                               .attr("clip-path", "url(#clip)");
        
        // draw pattern buttons
        this.patternButtons = this.focus.append("foreignObject").attr("id", "patternButtonsObject")
                                        .append("xhtml:div").attr("id", "patternButtonsForm");
        this.patternButtons.append("xhtml:input").attr("type", "button")
                                                 .attr("class", "btn btn-success")
                                                 .attr("value", "NEW BULL PATTERN")
                                                 .on("click", this.togglePatternCreation.bind(this, "1"));
        this.patternButtons.append("xhtml:input").attr("type", "button")
                                                 .attr("class", "btn btn-danger")
                                                 .attr("value", "NEW BEAR PATTERN")
                                                 .on("click", this.togglePatternCreation.bind(this, "-1"));

        // create zoom object
        // disable zooming (scale factor of one only)
        this.zoom = d3.zoom().scaleExtent([1, 1]);
        
        // call method that updates chart during zoom event
        this.zoom.on('zoom', () => { this.pan(); }); // on mousemove
        
        // call zoom on entire svg element so that panning is possible from whole svg
        this.svg.call(this.zoom);
        
        // Draw x axis
        this.gX = this.focus.append("g").attr("class", "axis")
                                        .attr("transform", "translate(0," + this.h + ")")
                                        .call(this.xAxis);

        // Draw x axis title
        this.xTitle = this.focus.append("text").attr("transform", "translate(" + (this.w/2) + " ," + (this.h + this.margin.top + this.margin.bottom/2) + ")")
                                               .style("text-anchor", "middle")
                                               .text(this.dateFormatter(this.averDate));

        // Draw y-axis
        this.gY = this.focus.append("g").attr("class", "axis").call(this.yAxis);

        // Draw x gridlines
        this.gGX = this.chartBody.append("g").attr("class", "grid").call(this.xGrid);
        
        // Draw y gridlines
        this.gGY = this.chartBody.append("g").attr("class", "grid").call(this.yGrid);
        
        // Create container for candles
        this.candles = this.chartBody.append("g").attr("id", "candles");

        // Create container for stems
        this.stems = this.chartBody.append("g").attr("id", "stems");

        // Draw candles and stems
        this.drawCandlesAndStems();
        
        // draw weekend line if necessary
        this.drawWeekendLine(this.dataPointer-this.noCandles, this.dataPointer);

        // draw existing patterns
        this.drawExistingPatterns(this.dataPointer-this.noCandles, this.dataPointer);

    }

    constructor(svg, pars, width, height, dataLeft, dataRight) {
        
        // declare variables for data processing
        this.dataPointer,
        this.isLoadingData = false,
        this.noPrevTransCandles = 0,
        this.priceArray = [],
        this.dtArray,
        this.averDate,
        this.xScale,
        this.xBand,
        this.xTicksArray = [],
        this.yLimitArray,
        this.yTicksArray,
        this.yScale,
        this.xAxis,
        this.xGrid,
        this.yAxis,
        this.yGrid;

        // declare variables for patterns
        this.patternArray = [];
        this.isCreatingNewPattern = false;
        this.newPatternDir;

        // declare variables for rendering
        this.focus,
        this.chartBody,
        this.zoom,
        this.gX,
        this.xTitle,
        this.gY,
        this.gGX,
        this.gGY,
        this.candles,
        this.stems,
        this.weekendLine,
        this.patternButtons,
        this.bullButtonLabel,
        this.bearButtonLabel;

        // create svg backbone
        this.svg = svg;

        this.width = width,
        this.height = height;

        // define margins
        this.margin = { top: 15, right: 30, bottom: 80, left: 80 },
	    this.w = this.width - this.margin.left - this.margin.right,
		this.h = this.height - this.margin.top - this.margin.bottom;
		
		// define number of candles displayed
		this.noCandles = parseFloat(pars['noCandles']);
		
		// define range of y axis
        this.yRange = parseFloat(pars['yRange']);

        // define number of minutes between x ticks
        this.xStep = parseFloat(pars['xStep']);
		
		// define step of y ticks
		this.yStep = parseFloat(pars['yStep']);
		
		// define number of decimal points of y labels
		this.yPrec = parseFloat(pars['yPrec']);
        
        // load up data and then draw chart
        this.processData(dataLeft, dataRight).then(() => { this.drawChart(); });

    }

}

