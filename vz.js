var cache = (function() {
  return {
    /**
     * Get object from localStorage by path
     */
    get: function (path, validHash, obj) {
      // console.log("[getCache] "+path+","+validHash+","+JSON.stringify(obj));
      var segments = path.trim().split('.');
      var segment = segments.shift();
      var result = (obj) ? obj[segment] : ((localStorage[segment]) ? JSON.parse(localStorage[segment]) : false);
      // console.log("[getCache] result("+segment+"): "+JSON.stringify(result));
      if (!result) return (false);

      if (segments.length) {
        return (this.get(segments.join('.'), validHash, result));
      }
      else {
        if (validHash) {
          if (validHash !== result.hash) return (false);
          delete result.hash;
        }
        return (result);
      }
    },

    /**
     * Put object to localStorage by path
     *
     * @todo Fix "hash" being added to obj when saving with hash
     */
    put: function (path, obj, validHash, root) {
      // console.log("[putCache] "+path+","+JSON.stringify(obj)+","+JSON.stringify(root));
      var segments = path.trim().split('.');
      var segment = segments.shift();

      if (root) {
        if (validHash && segments.length == 0) {
          obj.hash = validHash; // add hash to leaf node
        }     
        root[segment] = (segments.length) ? this.put(segments.join('.'), obj, validHash, root[segment] || {}) : obj;
        // console.log("[putCache] root("+segment+"): " + JSON.stringify(root));
        return (root);
      }

      root = (localStorage[segment]) ? JSON.parse(localStorage[segment]) || {} : {};    
      if (segments.length) {
        obj = this.put(segments.join('.'), obj, validHash, root)
      }
      else if (validHash) {
        obj.hash = validHash; // add hash to leaf node
      }
      localStorage[segment] = JSON.stringify(obj);
    }
  }
}());

(function($){

	/**
	 * Universal object filtering
	 * Returns object property where  child property 'key' matches given 'val'
	 */
	function filterProperties(obj, key, val) {
	  return(jQuery.map(obj, function(property) {
	    return (property[key] == val) ? property : null;
	  })[0])
	}

	function getURLParameter(name) {
		return decodeURIComponent(
			(new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)')
				.exec(location.search)||[,""])[1]
				.replace(/\+/g, '%20'))||null;
	}

	// json failure handler
	function failHandler(jqXHR, textStatus, errorThrown) { 
		$('#welcome').hide();
		$('#invalidApiKey').show();
	}

	function vzFetch(key, worker, deferred, hash) {
		console.log(key+" "+worker+" "+deferred+" "+hash);
		var json = cache.get(key, hash);

		if (json) {
			// console.log("-- vzFetch cached -- " + JSON.stringify(json));
			worker(json);
			return;
		}

		deferred.done(function(json) {
			// console.log("-- vzFetch deferred -- " + key + " " + JSON.stringify(json));
			cache.put(key, json, hash);
			worker(json);
		});
	}

	function updateChannel(channel, duration) {
		console.log("-- updateChannel -- " + JSON.stringify(channel));
		var now = moment();
		var then = moment();
		var dateTime = "DD.MM.YYYY+HH:mm";

		if(duration == '6hours') then.subtract('hours', 6);
		else if(duration == '1day') then.subtract('days', 1);
		else if(duration == '1week') then.subtract('weeks', 1);
		else if(duration == '1month') then.subtract('months', 1);
		else if(duration == '90days') then.subtract('days', 90);

		// Create Datastream UI
		$('#datastream-' + channel.uuid).remove();
		$('#feed-' + channel.uuid + ' .datastream.hidden').clone().appendTo('#feed-' + channel.uuid + ' .datastreams').attr('id', 'datastream-' + channel.uuid).removeClass('hidden');

		var url = middleware + "data/" + channel.uuid + ".json?padding=?&from=" + then.format(dateTime) + "&to=now&tuples=200";
		console.log("-- url -- " + url);

		$.getJSON(url, function(json) {
			console.log("-- json -- " + JSON.stringify(json));
			var datastream = json.data;

			var series = [];
			var points = [];

			// channel definition
			var caps = filterProperties(definitions, 'name', channel.type);

			// UUID
			$('#feed-' + channel.uuid + ' .data').show();
			$('#feed-' + channel.uuid + ' .min .value').html((datastream.min) ? datastream.min[1] + caps.unit : '-');
			$('#feed-' + channel.uuid + ' .max .value').html((datastream.max) ? datastream.max[1] + caps.unit : '-');
			$('#feed-' + channel.uuid + ' .average .value').html((datastream.hasOwnProperty('average')) ? datastream.average + caps.unit : '-');
			$('#feed-' + channel.uuid + ' .rows .value').html((datastream.hasOwnProperty('rows')) ? datastream.rows : '-');

			if (caps.hasConsumption) {
				$('#feed-' + channel.uuid + ' .consumption .value').html((datastream.hasOwnProperty('consumption')) ? datastream.consumption + caps.unit + 'h' : '-');
			} else {
				$('#feed-' + channel.uuid + ' .consumption').hide();
			}

			// Historical Datapoints
			if (datastream.tuples) {
				console.log("-- tuples --");

				// Add Each Datapoint to Array
				datastream.tuples.forEach(function(datapoint) {
					points.push({
						x: datapoint[0] / 1000.0,
						y: parseFloat(datapoint[1])
					});
				});

				// Add Datapoints Array to Graph Series Array
				series.push({
					name: datastream.uuid,
					data: points,
					color: channel.color || "steelblue",
				});

				// Initialize Graph DOM Element
				$('#datastream-' + datastream.uuid + ' .graph').attr('id', 'graph-' + datastream.uuid);

				var interpolation = 'linear';
				if (channel.style == 'steps') interpolation = 'step-after';

				// Build Graph
				var graph = new Rickshaw.Graph({
					element: document.querySelector('#graph-' + datastream.uuid),
					width: 800,
					height: 200,
					renderer: 'line',
					padding: {
						top: 0.02,
						right: 0.02,
						bottom: 0.02,
						left: 0.02
					},
					series: series,
					interpolation: interpolation
				});
				graph.render();

				var ticksTreatment = 'glow';

				// Define and Render X Axis (Time Values)
				var xAxis = new Rickshaw.Graph.Axis.Time({
					graph: graph,
					ticksTreatment: ticksTreatment
				});
				xAxis.render();

				// Define and Render Y Axis (Datastream Values)
				var yAxis = new Rickshaw.Graph.Axis.Y({
					graph: graph,
					tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
					ticksTreatment: ticksTreatment
				});
				yAxis.render();

				// Enable Datapoint Hover Values
				var hoverDetail = new Rickshaw.Graph.HoverDetail({
					graph: graph,
					formatter: function(series, x, y) {
						var swatch = '<span class="detail_swatch" style="background-color: ' + series.color + ' padding: 4px;"></span>';
						var content = swatch + "&nbsp;&nbsp;" + parseFloat(y) + caps.unit + '&nbsp;&nbsp;<br>';
						return content;
					}
				});

				$('#datastream-' + datastream.uuid + ' .slider').attr('id', 'slider-' + datastream.uuid);
				var slider = new Rickshaw.Graph.RangeSlider({
								graph: graph,
								element: $('#slider-' + datastream.uuid)
				});
			} else {
				$('#datastream-' + datastream.uuid + ' .graphWrapper').addClass('hidden');
				$('#datastream-' + datastream.uuid + ' .message').removeClass('hidden');
			}

			$('#loadingData').foundation('reveal', 'close');
		});
	}

	function setChannel(channel) {
		console.log("-- setChannel -- " + JSON.stringify(channel));

		var caps = filterProperties(definitions, 'name', channel.type);

		$('#feed-' + channel.uuid).remove();

		// duplicate Example to Build Feed UI
		$('#exampleFeed').clone().appendTo('#feeds').attr('id', 'feed-' + channel.uuid).removeClass('hidden');

		// UUID
		$('#feed-' + channel.uuid + ' .id .value').html(channel.uuid);
		// Title
		$('#feed-' + channel.uuid + ' .title .value').html(channel.title);
		// Type
		$('#feed-' + channel.uuid + ' .type .value').html(channel.type);
		// Unit
		$('#feed-' + channel.uuid + ' .unit .value').html((caps.hasOwnProperty('unit')) ? caps.unit : '-');
		// Link
		$('#feed-' + channel.uuid + ' .link .value').html('<a href="' + middleware + "data/" + channel.uuid + '.json">View raw data</a>');

		// buttons
		$('#feed-' + channel.uuid + ' .duration-hour').click(function() {
			// $('#loadingData').foundation('reveal', 'open');
			updateChannel(channel, '6hours');
			return false;
		});

		$('#feed-' + channel.uuid + ' .duration-day').click(function() {
			// $('#loadingData').foundation('reveal', 'open');
			updateChannel(channel, '1day');
			return false;
		});

		$('#feed-' + channel.uuid + ' .duration-week').click(function() {
			// $('#loadingData').foundation('reveal', 'open');
			updateChannel(channel, '1week');
			return false;
		});

		$('#feed-' + channel.uuid + ' .duration-month').click(function() {
			// $('#loadingData').foundation('reveal', 'open');
			updateChannel(channel, '1month');
			return false;
		});

		$('#feed-' + channel.uuid + ' .duration-90').click(function() {
			// $('#loadingData').foundation('reveal', 'open');
			updateChannel(channel, '90days');
			return false;
		});
	}

	function setSingleChannel(json) {
		console.log("-- setSingleChannel -- ");
		$('#welcome').addClass('hidden');

		setChannel(json.entity);
	}

	function setChannels(json) {
		console.log("-- setChannels -- ");
		$('#welcome').addClass('hidden');

		$.each(json.channels, function(i, channel) {
			setChannel(channel);
		});
	}

	function setDefinitions(json) {
		console.log("-- setDefinitions -- ");
		definitions = json.capabilities.definitions.entities;
		console.log(JSON.stringify(definitions));
	}

	var middleware = getURLParameter('middleware');
	var channels = getURLParameter('channels');
	var definitions;

	if (channels) {
		$('#channelInput').val(channels);
	}
	if (middleware) {
		$('#apiInput').val(middleware);

		// TODO failure handling .fail(failHandler)
		var url = middleware + 'capabilities/definitions.json?padding=?';
		vzFetch("xmon.definitions", setDefinitions, $.getJSON(url), url);

		var url = middleware;
		if (channels) {
			url += "entity/" + channels + ".json?padding=?";
			vzFetch("xmon.channel." + channels, setSingleChannel, $.getJSON(url).fail(failHandler), url);
		}
		else {
			url += "channel.json?padding=?";
			vzFetch("xmon.channels", setChannels, $.getJSON(url).fail(failHandler), url);
		}
	}

	$('#setFeeds').click(function() {
		// channels = $('#channelInput').val().replace(/\s+/g, '').split(',');
		window.location = './index.html?middleware=' + $('#apiInput').val() + '&channels=' + $('#channelInput').val();
		return false;
	});

})( jQuery );
