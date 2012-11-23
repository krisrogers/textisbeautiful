/**
 * Cloud visualisation.
 */

/// IN PROGRESS
///////////////////
/// TODO
//// - Colours/themes
//// - Prefer positioning based on relatedness (test alphabetically)?
//// - Font sizing scale options
//// - More orientations
//// - Word limit
//////////////////

/**
 * Encapsulates the Concept Cloud visualisation.
 */
tib.vis.ConceptCloud = function ConceptCloud (config, data) {

    var orientations = {
        'Messy' : [5, 30, 60],
        'Horizontal' : [0, 0, 0],
        'Vertical' : [0, 0, 90]
    };

    /////////////////
    // Setup class properties
    /////////////////
    // Defaults
    this.bold = false;
    this.italic = false;
    this.fill = d3.scale.category20();
    this.font = 'Trebuchet MS';
    this.fontSize = d3.scale.pow().range([8, 160]);
    this.mode = 'Archimedean';
    this.orientation = orientations['Horizontal'];
    this.webMode = false;
    this.words = [];

    $.extend(this, config);

    this.layout = null;
    var self = this;

    /*
     * Create the data structures need for this vis from the JSON the server returned.
     */
    var loadData = function(data) {
        var cluster = {};
        var mst = [];
        var words = [];
        var wordsForName = {};
        var wordNamesForId = {};
        var minSize = null;
        var maxSize = null;
        for (var id in data.markers.concepts) {
            var w = data.markers.concepts[id];
            words.push(word = {
                edges: w.mstEdges,
                size: parseInt(w.weight, 10),
                text: w.value
            });
            if (minSize == null) {
                minSize = maxSize = word.size;
            }
            else {
                minSize = Math.min(minSize, word.size);
                maxSize = Math.max(maxSize, word.size)
            }
            cluster[word.text] = {
                x: w.x * self.width/2,
                y: w.y * self.height/2
            };
            wordNamesForId[w.id] = w.value;
            wordsForName[word.text] = word;
        }

        // Sort words by size, decreasing
        words.sort(function (a, b) { return b.size - a.size;});

        // Normalise text size and build mst
        for (var i = 0; i < words.length; i++) {
            var word = words[i];
            for (var j = 0; j < word.edges.length; j++) {
                var toWordName = wordNamesForId[word.edges[j].to];
                mst.push({
                    x1: cluster[word.text].x,
                    y1: cluster[word.text].y,
                    x2: cluster[toWordName].x,
                    y2: cluster[toWordName].y
                });
            }
        }

        return  {
            cluster: cluster,
            mst: mst,
            sizeDomain: [minSize, maxSize],
            words: words,
            wordsForName: wordsForName
        };
    };
    $.extend(this, loadData(data));
    this.fontSize.domain(this.sizeDomain);
    
    /**
     * Cleanup all traces of this visualisation.
     */
    this.destroy = function () {
        this.selector().remove();
        $('#vis-menu .cloud-menu').remove();
    };

    /**
     * Export cloud as image/png.
     */
    this.downloadPNG = function () {
        
        // Use canvas to generate png data
        var canvas = document.createElement("canvas"),
            c = canvas.getContext("2d");
        var self = this;

        canvas.width = self.width;
        canvas.height = self.height;
        c.translate(self.width >> 1, self.height >> 1);
        c.scale(1, 1);
        

        // Links
        this.selector().selectAll('path').each(function (line) {
            c.strokeStyle = "#ccc";
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(line.x1, line.y1);
            c.lineTo(line.x2, line.y2);
            c.stroke();
            c.closePath();
        });
        
        // Words
        this.selector().selectAll("text").each(function (word) {
            c.save();
            if (self.webMode) {
                c.translate(self.cluster[word.text].x, self.cluster[word.text].y);
                c.font = getFontSizeForWeb(word.size) + "px " + word.font;
            }
            else {
                c.translate(word.x, word.y);
                c.font = word.size + "px " + word.font;
            }
            c.rotate(word.rotate * Math.PI / 180);
            c.textAlign = "center";
            c.fillStyle = word.fill;
            c.fillText(word.text, 0, 0);
            c.restore();
        });
        
        window.open(canvas.toDataURL("image/png"));
    };

    /**
     * Select the layout mode for the cloud.
     *
     * @param value The string value for the layout desired.
     */
    this.selectMode = function (value) {
        self.mode = value;
        self.draw({forceRedraw: true});
    };
    
    /**
     * Returns the d3 selector for this visualisation.
     */
    this.selector = function () {
        return d3.select('#' + this.drawTarget + ' svg');
    }
    
    /**
     * Draw the concept cloud visualisation.
     */
    this.draw = function (params) {
        
        params = params || {};
        if (params.webMode === undefined) {
            params.webMode = this.webMode;
        }
        
        if (!this.drawn) {
            $('#' + this.drawTarget).css('width', String(this.width) + 'px');
            this.initMenu();
        }
        
        if (params.webMode !== this.webMode && this.drawn) {
            // Toggle between web and cloud mode
            this.toggleWeb();
        }
        else if (!this.drawn || params.forceRedraw) {
            this.webMode = params.webMode;
            // Draw
            generate();
            this.drawn = true;
        }
    };
    
    /**
     * Select a font for the cloud.
     * @param {String} font The font name of the desired font
     */
    this.selectFont = function (font) {
        if (font != this.font) {
            this.font = font;
            this.draw({forceRedraw: true});    
        }
    };

    this.selectOrientation = function(orientation) {
        self.orientation = orientations[orientation];
        self.draw({forceRedraw: true});
    };
    
    /**
     * Toggle style attribute (bold, italic).
     * @param name The string style desired. Valid options or 'bold' or 'italic'.
     */
    this.toggleStyle = function (name) {
        name = name.toLowerCase();
        var self = this;
        if (name == 'bold' || name == 'italic') {
            this[name] = !this[name];
            if (this.webMode) {
                this.selector().selectAll('text')
                    .style("font-style", this.italic ? 'italic' : 'normal')
                    .style("font-weight", this.bold ? 'bold' : 'normal')
            }
            else {
                this.draw({forceRedraw: true});    
            }
        }
    };
    
    /**
     * Toggle concept web visualisation mode.
     */
    this.toggleWeb = function () {
        
        this.webMode = !this.webMode;
        
        $('#vis-types li').removeClass('active');
        
        if (this.webMode === true) {
            $('#cloud-menu-layout').hide();
            $('#cloud-menu-refresh').hide();
            $('#vis-types li.web').addClass('active');
            
        }
        else {
            $('#cloud-menu-layout').show();
            $('#cloud-menu-refresh').show();
            $('#vis-types li.cloud').addClass('active');
        }
        
        drawSpanningTreeLinks();
            
        this.selector().selectAll('text').transition()
            .duration(750)
            .style("font-size", function(d) { return (self.webMode ? getFontSizeForWeb(d.size) : d.size) + "px"; })
            .attr("transform", function(d) {
                var x = self.webMode ? self.cluster[d.text].x : d.x;
                var y = self.webMode ? self.cluster[d.text].y : d.y;
                return "translate(" + [x, y] + ")rotate(" + (self.webMode ? 0 : d.rotate) + ")";
            });
    };
    
    // Draw the links for the MST.
    var drawSpanningTreeLinks = function () {
        self.selector().selectAll('path').remove();
        if (self.webMode === true) {
            self.selector().selectAll('path').data(self.mst)
                .enter().insert("path", ":first-child")
                .attr("d", function (d) { return "M " + d.x1 + ", " + d.y1 + " L" + d.x2 + ", " + d.y2})
                .attr("transform", "translate(" + self.width/2 + "," + self.height/2 + ")")
                .style("stroke-width", 1)
                .style("stroke", "#ccc")
                .style("fill", "none");
        }
    };
    
    // Render the words
    var drawWords = function (words) {
        self.renderedWords = words;
        $('div#' + self.drawTarget).empty();
            d3.select("div#" + self.drawTarget).append("svg")
                .attr("width", self.width)
                .attr("height", self.height)
                .append("g")
                    .attr("transform", "translate(" + self.width/2 + "," + self.height/2 + ")")
                    .selectAll("text")
                    .data(words)
                    .enter().append("text")
                        .style("font-size", function(d) { return d.size + "px"; })
                        .style("font-family", self.font)
                        .style("font-style", self.italic ? 'italic' : 'normal')
                        .style("font-weight", self.bold ? 'bold' : 'normal')
                        .style("fill", function(d, i) { d.fill = self.fill(i); return d.fill; })
                        .attr("text-anchor", "middle")
                        .attr("transform", function(d) {
                            return "translate(" + [self.webMode ? self.cluster[d.text].x : d.x, self.webMode ? self.cluster[d.text].y : d.y] + ")rotate(" + (self.webMode ? 0 : d.rotate) + ")";
                        })
                        .text(function(d) { return d.text; });
                        
        if (self.webMode) {
            self.selector().selectAll('text').style("font-size", function(d) { return getFontSizeForWeb(d.size) + "px"; })
            drawSpanningTreeLinks();
        }
    };
    
    // Start the D3 drawing process
    var generate = function () {
        self.layout = d3.layout.cloud().size([self.width, self.height])
            .words(self.words)
            .rotate(function() { return ~~(Math.random() * self.orientation[0]) * self.orientation[1] - self.orientation[2]; })
            .spiral(self.mode.toLowerCase())
            .font(self.font)
            .fontSize(function(d) { return self.fontSize(+d.size); })
            .fontStyle(self.italic ? 'italic' : '')
            .fontWeight(self.bold ? 'bold' : 'normal')
            .on("end", drawWords)
            .start();
    };
    
    // Determine font size for web mode
    var getFontSizeForWeb = function (originalSize) {
        return 2 + 3 * Math.sqrt(originalSize);
    };

    /**
     * Initialise the menu for this vis. This method injects the menu into the corrext place.
     */
    this.initMenu = function () {

        // Top level menu
        var menuContainer = $('#vis-menu');

        /* Build the menu - last has to come first to preserve the share button */
        // Layout selection
        $(menuContainer).prepend('<li class="cloud-menu dropdown" id="cloud-menu-layout"><a class="dropdown-toggle" data-toggle="dropdown" href="#">Layout<b class="caret"></b></a><ul class="dropdown-menu" id="cloud-menu-layout"></ul></li>');
        var layoutMenu = $('#cloud-menu-layout ul');
        // Mode options
        layoutMenu.append($('<li class="nav-header">Cloud Shape</li>'));
        $(['Archimedean', 'Rectangular']).each(function (i, mode) {
            var listEl = $('<li class="mode"><a href="#">' + mode.replace('Archimedean', 'Circular') + '</a></li>');
            // Click handler
            listEl.click(function(e) {
                e.preventDefault();
                self.selectMode(mode);
                $('ul#cloud-menu-layout li.mode').removeClass('active');
                listEl.addClass('active');
            });
            if (mode == self.mode) {
                listEl.addClass('active')
            }
            layoutMenu.append(listEl);
        });
        // Orientation options
        layoutMenu.append($('<li class="nav-header">Word Orientation</li>'));
        $.each(orientations, function (key, value) {
            var listEl = $('<li class="orientation"><a href="#">' + key + '</a></li>');
            // Click handler
            listEl.click(function(e) {
                e.preventDefault();
                self.selectOrientation(key);
                $('ul#cloud-menu-layout li.orientation').removeClass('active');
                listEl.addClass('active');
            });

            if (value == self.orientation) {
                listEl.addClass('active')
            }
            layoutMenu.append(listEl);
        });

        // Font selection
        $(menuContainer).prepend('<li class="cloud-menu dropdown"><a class="dropdown-toggle" data-toggle="dropdown" href="#">Font<b class="caret"></b></a><ul class="dropdown-menu" id="cloud-menu-text"></ul></li>');
        var fontMenu = $('ul#cloud-menu-text');
        // Style options
        fontMenu.append($('<li class="nav-header">Style</li>'));
        $('<li class="style"><a href="#" style="font-weight:bold">Bold</a></li>').appendTo(fontMenu)
            // Click handler
            .click(function(e) {
                e.preventDefault();
                // This is set to the event target
                $(this).toggleClass('active');
                self.toggleStyle('bold');
            });
        $('<li class="style"><a href="#" style="font-weight:bold">Italic</a></li>').appendTo(fontMenu)
            // Click handler
            .click(function(e) {
                e.preventDefault();
                $(this).toggleClass('active');
                self.toggleStyle('italic');
            });
        // Font Family options
        fontMenu.append('<li class="nav-header">Font</li>');
        $(tib.uic.FONTS).each(function (i, font) {
            var listEl = $('<li class="font"><a href="#" style="font-family:' + font + '">' + font + '</a></li>');
            // Click handler
            listEl.click(function(e) {
                e.preventDefault();
                self.selectFont(font);
                $('ul#cloud-menu-text li.font').removeClass('active');
                listEl.addClass('active');
            });
            // Make sure the current font is set as active.
            if (font == self.font) {
                listEl.addClass('active');
            }
            fontMenu.append(listEl);
        });

        // Refresh button
        $('<li class="cloud-menu" id="cloud-menu-refresh"><a href="#">Refresh</a></li>').prependTo(menuContainer)
            .click(function(e) {
                e.preventDefault();
                self.draw({forceRedraw: true});
            });
    };

    return this;
};