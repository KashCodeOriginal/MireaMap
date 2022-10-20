/*
 * Mapplic - Custom Interactive Map Plugin by @sekler
 * Version 7.1.2
 * https://www.mapplic.com/
 */

;(function($) {
	"use strict";

	var Mapplic = function(element) {

		var self = this;

		self.o = {
			source: 'locations.json',
			selector: '[id^=MLOC] > *, [id^=landmark] > *, svg > #items > *',
			external: '.mapplic-external',
			scope: null,
			customcss: null,
			iconfile: null,
			height: 'auto',
			minheight: 400,
			maxheight: 800,
			csv: false,
			landmark: false,
			portrait: 860,
			minimap: false,
			deeplinking: true,
			lightbox: true,
			fullscreen: false,
			hovertip: true,
			defaultstyle: null,
			moretext: null,
			action: 'default',
			marker: '',
			developer: false,
			smartip: false,
			animations: false,
			hovertipdesc: false,

			// sidebar
			sidebar: true,
			sidebartoggle: false,
			filtersopened: false,
			search: true,
			searchlength: 1,
			searchfields: ['title', 'about', 'category'],
			searchdescription: false,
			highlight: true,
			thumbholder: false,
			autopopulate: false,
			sortby: 'title',

			// zoom
			zoom: true,
			clearbutton: true,
			zoombuttons: true,
			zoomoutclose: false,
			closezoomout: true,
			linknewtab: false,
			mousewheel: true,
			mapfill: false,
			zoommargin: 200,
			maxscale: 3,

			// UI Colors
			basecolor: null,
			bgcolor: null,
			bgcolor2: null,
			headingcolor: null,
			textcolor: null,
			accentcolor: null
		};

		self.loc = {
			more: 'More',
			search: 'Search',
			zoomin: 'Zoom in',
			zoomout: 'Zoom out',
			resetzoom: 'Reset zoom',
			levelup: 'Level up',
			leveldown: 'Level down',
			clearsearch: 'Clear search',
			closepopup: 'Close popup',
			clearfilter: 'Clear filter',
			iconfile: 'mapplic/images/icons.svg'
		}

		self.el = element;

		self.init = function(options) {

			// merging options with defaults
			self.o = $.extend(self.o, options);
			if (typeof mapplic_localization !== 'undefined') self.loc = $.extend(self.loc, mapplic_localization);
			if (self.o.iconfile) self.loc.iconfile = self.o.iconfile;

			self.el.addClass('mapplic-element mapplic-loading');

			// trigger event
			self.el.trigger('mapload', self);
			
			// scope
			if (self.o.scope) self.scope = $(self.o.scope);
			else self.scope = self.el;

			// process map data
			var data = self.el.data('mapdata');
			if (self.el.data('mapdata')) {
				var mapdata = self.el.data('mapdata');
				self.el.removeAttr('data-mapdata').removeData('mapdata');
				processData(mapdata);
				self.el.removeClass('mapplic-loading');
			}
			else if (typeof self.o.source === 'string') {
				// loading .json file with AJAX
				$.getJSON(self.o.source, function(data) {
					processData(data);
					self.el.removeClass('mapplic-loading');
				}).fail(function() { // Failure: couldn't load JSON file or it is invalid.
					console.error('Couldn\'t load map data. (Make sure to run the script through web server)');
					self.el.removeClass('mapplic-loading').addClass('mapplic-error');
					alert('Data file missing or invalid!\nMake sure to run the script through web server.');
				});
			}
			else {
				// inline json object
				processData(self.o.source);
				self.el.removeClass('mapplic-loading');
			}

			return self;
		}

		// tooltip
		function Tooltip() {
			this.el = null;
			this.pin = null;
			this.shift = 6;
			this.drop = 0;
			this.location = null;

			this.init = function(location, check) {
				var s = this;

				// markup
				this.el = $('<div></div>').addClass('mapplic-tooltip');
				this.wrap = $('<div></div>').addClass('mapplic-tooltip-wrap').appendTo(this.el);
				this.close = $('<button></button>').append(getIcon('icon-cross')).addClass('mapplic-tooltip-close').attr('aria-label', self.loc.closepopup).on('click touchend', function(e) {
					e.preventDefault();
					self.hideLocation();
					if (!self.o.zoom || self.o.zoomoutclose) self.moveTo(0.5, 0.5, self.fitscale, 400);
				}).appendTo(this.wrap);
				this.image = $('<img>').addClass('mapplic-image').attr('alt', 'Location image').hide().appendTo(this.wrap);
				this.body = $('<div></div>').addClass('mapplic-tooltip-body').attr('aria-modal','true').appendTo(this.wrap);
				this.title = $('<h4></h4>').addClass('mapplic-tooltip-title').appendTo(this.body);
				this.content = $('<div></div>').addClass('mapplic-tooltip-content').appendTo(this.body);
				this.desc = $('<div></div>').addClass('mapplic-tooltip-description').appendTo(this.content);
				this.link = $('<a>' + self.loc.more + '</a>').addClass('mapplic-popup-link').attr('href', '#').hide().appendTo(this.body);
				if (self.o.linknewtab) this.link.attr('target', '_blank');
				this.triangle = $('<div></div>').addClass('mapplic-tooltip-triangle').prependTo(this.wrap);

				// no focus on deeplink
				if (!check) this.body.attr('tabindex', '-1');

				$('.mapplic-layer.mapplic-visible', self.map).append(this.el);

				if (self.o.smartip) self.el.on('positionchanged', {s: s},  this.repos);

				this.el.css({'transform': 'scale(' + 1/self.scale + ')'});

				if (location) this.show(location);

				// close tooltip
				$(document).on('keyup.mapplic', function(e) {
					e.stopImmediatePropagation();
					if ((e.keyCode === 27)) {
						self.hideLocation();
						if (!self.o.zoom || self.o.zoomoutclose) self.moveTo(0.5, 0.5, self.fitscale, 400);
					}
				});

				return this;
			}

			this.repos = function(e) {
				var s = e.data.s,
					tx = '-50%',
					ty = '-100%';

				// vertical
				var rtop = s.el.offset().top - self.container.el.offset().top;
				if (rtop < s.wrap.outerHeight() + 36) {
					s.el.addClass('mapplic-tooltip-bottom');
					ty = "0%";
				}
				else {
					s.el.removeClass('mapplic-tooltip-bottom');
					ty = "-100%";
				}
			
				// horizontal
				var rleft = s.el.offset().left - self.container.el.offset().left;
				if (rleft < s.wrap.outerWidth() / 2) {
					if (rleft > 12) tx = -(100 + rleft / s.wrap.outerWidth() * 100) + 100 + "%";
					else tx = "-10%";
				}
				else if (rleft > self.container.el.outerWidth() - s.wrap.outerWidth() / 2) {
					if (rleft < self.container.el.outerWidth() - 12) tx = (self.container.el.outerWidth() - rleft) / s.wrap.outerWidth() * 100 - 100 + "%";
					else tx = "-90%";
				}
				else tx = "-50%"

				s.wrap.css({ 'transform': 'translate(' + tx + ', ' + ty + ')' });
			}

			this.show = function(location) {
				if (location) {
					var s = this;

					this.el.attr('data-location', location.id);

					this.location = location;
					if (self.hovertip) self.hovertip.hide();

					if (location.image) {
						this.image.attr('src', '');
						this.image.attr('src', location.image).show();
					}
					else this.image.hide();

					if (location.link) {
						this.link.attr('href', location.link).css('background-color', '').show();
						if (location.color) this.link.css('background-color', location.color);
					}
					else this.link.hide();

					this.title.text(location.title);
					if (location.description) this.desc.html(location.description);
					else this.desc.empty();
					this.content[0].scrollTop = 0;

					// shift
					this.pin = $('.mapplic-pin[data-location="' + location.id + '"]');
					if (this.pin.length == 0) {
						this.shift = 20;
					}
					else this.shift = Math.abs(parseFloat(this.pin.css('margin-top'))) + 20;
				
					// making it visible
					this.el.stop().css({opacity: 1}).show();
					setTimeout(function() {s.body.focus() }, 600);
					this.position();
					if (self.o.zoom) this.zoom(location);

					// loading & positioning
					/*
					$('img', this.el).off('load').on('load', function() {
						s.position();
						if (self.o.zoom) s.zoom(location);
					});*/
				}
			}

			this.position = function() {
				if (this.location) {
					this.el.css({
						left: (this.location.x * 100) + '%',
						top: (this.location.y * 100) + '%'
					});
					this.drop = this.el.outerHeight() + this.shift;
					if (self.o.smartip) this.repos({ data: { s: this}});
				}
			}

			this.zoom = function(location) {
				var ry = 0.5,
					zoom = location.zoom ? parseFloat(location.zoom)/self.o.maxscale : 1;

				ry = (self.container.el.height()/2 + this.drop/2) / self.container.el.height();
				self.moveTo(location.x, location.y, zoom, 600, ry);
			}

			this.hide = function() {
				var s = this;

				this.location = null;
				this.el.stop().fadeOut(200, function() { $(this).remove(); });
				if (self.o.smartip) self.el.off('positionchanged', this.repos);
			}
		}

		// hover tooltip
		function HoverTooltip() {
			this.el = null;
			this.pin = null;
			this.shift = 6;

			this.init = function() {
				var s = this;

				// construct
				this.el = $('<div></div>').addClass('mapplic-tooltip mapplic-hovertip');
				this.wrap = $('<div></div>').addClass('mapplic-tooltip-wrap').appendTo(this.el);
				this.title = $('<h4></h4>').addClass('mapplic-tooltip-title').appendTo(this.wrap);
				if (self.o.hovertipdesc) this.desc = $('<div></div>').addClass('mapplic-tooltip-description').appendTo(this.wrap);
				this.triangle = $('<div></div>').addClass('mapplic-tooltip-triangle').appendTo(this.wrap);

				// events 
				// markers + old svg
				$(self.map).on('mouseover', '.mapplic-pin', function() {
					var id = $(this).data('location');

					s.pin = $('.mapplic-pin[data-location="' + id + '"]');
					s.shift = Math.abs(parseFloat(s.pin.css('margin-top'))) + 20;

					var location = self.l[id];
					if (location && location.title) s.show(location);
				}).on('mouseout', function() {
					s.hide();
				});

				// new svg
				if (self.o.selector) {
					$(self.map).on('mouseover touchstart', self.o.selector, function() {
						var location = self.l[$(this).attr('id')];
						s.shift = 20;
						if (location && location.title) s.show(location);
					}).on('mouseout touchend', function() {
						s.hide();
					});
				}

				self.el.on('positionchanged', {s: s},  this.repos);

				self.map.append(this.el);

				return this;
			}

			this.repos = function(e) {
				var s = e.data.s,
					tx = '-50%',
					ty = '-100%';

				// vertical
				var rtop = s.el.offset().top - self.container.el.offset().top;
				if (rtop < s.wrap.outerHeight() + 36) {
					s.el.addClass('mapplic-tooltip-bottom');
					ty = "0%";
				}
				else {
					s.el.removeClass('mapplic-tooltip-bottom');
					ty = "-100%";
				}
			
				// horizontal
				var rleft = s.el.offset().left - self.container.el.offset().left;
				if (rleft < s.wrap.outerWidth() / 2) {
					if (rleft > 12) tx = -(100 + rleft / s.wrap.outerWidth() * 100) + 100 + "%";
					else tx = "-10%";
				}
				else if (rleft > self.container.el.outerWidth() - s.wrap.outerWidth() / 2) {
					if (rleft < self.container.el.outerWidth() - 12) tx = (self.container.el.outerWidth() - rleft) / s.wrap.outerWidth() * 100 - 100 + "%";
					else tx = "-90%";
				}
				else tx = "-50%"

				s.wrap.css({ 'transform': 'translate(' + tx + ', ' + ty + ')' });
			}

			this.show = function(location) {
				if (self.location != location) {
					this.title.text(location.title);
					if (self.o.hovertipdesc) {
						if (location.description) this.desc.html(location.description);
						else this.desc.empty();
					}
					this.position(location);

					this.el.stop().fadeIn(100);
				}
				this.repos({ data: { s: this}});
			}

			this.position = function(location) {
				if (location) {
					this.el.css({
						left: (location.x * 100) + '%',
						top: (location.y * 100) + '%'
					});

					this.drop = this.el.outerHeight() + this.shift;
				}
			}

			this.hide = function() {
				this.el.stop().fadeOut(200);
			}
		}

		// lightbox
		function Lightbox() {
			this.el = null;

			this.init = function() {
				// construct
				this.el = $('<div></div>').addClass('mapplic-lightbox mfp-hide');
				this.title = $('<h4></h4>').addClass('mapplic-lightbox-title').appendTo(this.el);
				this.desc = $('<div></div>').addClass('mapplic-lightbox-description').appendTo(this.el);
				this.link = $('<a>' + self.loc.more + '</a>').addClass('mapplic-popup-link').attr('href', '#').hide().appendTo(this.el);
				if (self.o.linknewtab) this.link.attr('target', '_blank');

				// append
				self.el.append(this.el);

				return this;
			}

			this.show = function(location) {
				this.location = location;

				this.title.text(location.title);
				this.desc.html(location.description);

				if (location.link) {
					this.link.attr('href', location.link).css('background-color', '').show();
					if (location.color) this.link.css('background-color', location.color);
				}
				else this.link.hide();

				var s = this;

				$.magnificPopup.open({
					items: { src: this.el },
					type: 'inline',
					removalDelay: 300,
					mainClass: 'mfp-fade',
					callbacks: {
						beforeClose: function() {
							s.hide();
						}
					}
				});

				// zoom
				var zoom = location.zoom ? parseFloat(location.zoom) : 1;
				if (self.o.zoom) self.moveTo(location.x, location.y, zoom, 600);

				return this.el[0];
			}

			this.showImage = function(location) {
				this.location = location;

				var s = this;

				$.magnificPopup.open({
					items: { src: location.image },
					type: 'image',
					removalDelay: 300,
					mainClass: 'mfp-fade',	
					callbacks: {
						beforeClose: function() {
							s.hide();
						}
					}
				});

				// zoom
				var zoom = location.zoom ? parseFloat(location.zoom) : 1;
				if (self.o.zoom) self.moveTo(location.x, location.y, zoom, 600);
			}

			this.hide = function() {
				this.location = null;
				this.desc.empty();
				self.hideLocation();
				if (!self.o.zoom || self.o.zoomoutclose) self.moveTo(0.5, 0.5, self.fitscale, 400);
			}
		}

		// external
		function External() {
			this.el = null;

			this.init = function() {
				this.el = $('<div></div>').addClass('mapplic-external-content').hide();
				this.title = $('<h4></h4>').addClass('mapplic-external-title').appendTo(this.el);
				this.desc = $('<div></div>').addClass('mapplic-external-description').appendTo(this.el);

				this.initial = $(self.o.external + ' > *:not(.mapplic-external-content)');

				$(self.o.external).append(this.el);
				
				return this;
			}

			this.show = function(location) {
				this.title.text(location.title);
				this.desc.html(location.description);

				this.initial.hide();
				this.el.show();
			}

			this.hide = function() {
				this.initial.show();
				this.el.hide();
			}
		}

		// deeplinking
		function Deeplinking() {
			this.param = 'location';
			this.resolved = false;

			this.init = function() {
				var s = this;

				window.onpopstate = function(e) {
					if (e.state) s.check(600);
					return false;
				}
			}

			this.check = function(duration) {
				var id = this.getUrlParam(this.param);
				if (id) {
					self.showLocation(id, duration, true);
					this.resolved = true;
				}
			}

			this.getUrlParam = function(name) {
				name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
				var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
					results = regex.exec(location.search);
				return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
			}

			this.update = function(id) {
				var url;
				if (typeof window.URL !== 'undefined') {
					url = new URL(window.location.href);
					url.searchParams.set(this.param, id);
					url = url.href
				} else {
					url = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + this.param + '=' + id;
				}
				window.history.pushState({path: url}, '', url);
			}

			this.clear = function() {
				var url;
				if (typeof window.URL !== 'undefined') {
					url = new URL(window.location.href);
					url.searchParams.delete(this.param);
					url = url.href;
				} else {
					url = window.location.pathname;
				}
				history.pushState('', document.title, url);
			}
		}

		// old hash deeplinking method for old browsers (starting IE9)
		function DeeplinkingHash() {
			this.param = 'location';
			this.resolved = false;

			this.init = function() {
				var s = this;
				this.check(0);

				$(window).on('hashchange', function() {
					//s.check(600);
				});
			}

			this.check = function(duration) {
				var id = location.hash.slice(this.param.length + 2);
				if (id) {
					self.showLocation(id, duration, true);
					this.resolved = true;
				}
			}

			this.update = function(id) {
				window.location.hash = this.param + '-' + id;
			}

			this.clear = function() {
				window.location.hash = this.param;
			}
		}

		// minimap
		function Minimap() {
			this.el = null;
			this.opacity = null;

			this.init = function() {
				this.el = $('<div></div>').addClass('mapplic-minimap').appendTo(self.container.el);
				this.el.click(function(e) {
					e.preventDefault();

					var x = (e.pageX - $(this).offset().left) / $(this).width(),
						y = (e.pageY - $(this).offset().top) / $(this).height();

					self.moveTo(x, y, self.scale / self.fitscale, 100);
				});

				return this;
			}

			this.addLayer = function(data) {
				var layer = $('<div></div>').addClass('mapplic-minimap-layer').attr('data-floor', data.id).appendTo(this.el),
					s = this;

				$('<img>').attr('src', data.minimap).addClass('mapplic-minimap-background').attr('aria-hidden', 'true').appendTo(layer);
				$('<div></div>').addClass('mapplic-minimap-overlay').appendTo(layer);
				$('<img>').attr('src', data.minimap).addClass('mapplic-minimap-active').attr('aria-hidden', 'true').on('load', function() {
					s.update();
				}).appendTo(layer);
			}

			this.show = function(target) {
				$('.mapplic-minimap-layer', this.el).hide();
				$('.mapplic-minimap-layer[data-floor="' + target + '"]', this.el).show();
			}

			this.update = function(x, y) {
				var active = $('.mapplic-minimap-active', this.el);

				if (x === undefined) x = self.x;
				if (y === undefined) y = self.y;

				var width = (self.container.el.width() / self.contentWidth / self.scale * this.el.width()),
					height = (self.container.el.height() / self.contentHeight / self.scale * this.el.height()),
					top = (-y / self.contentHeight / self.scale * this.el.height()),
					left = (-x / self.contentWidth / self.scale * this.el.width()),
					right = left + width,
					bottom = top + height;

				active.each(function() {
					$(this)[0].style.clip = 'rect(' + top + 'px, ' + right + 'px, ' + bottom + 'px, ' + left + 'px)';
				});

				// fade out effect
				var s = this;
				this.el.show();
				this.el.css('opacity', 1.0);
				clearTimeout(this.opacity);
				this.opacity = setTimeout(function() {
					s.el.css('opacity', 0);
					setTimeout(function() { s.el.hide(); }, 600);
				}, 2000);
			}
		}

		// legend
		function Legend() {
			this.el = null;
			this.nr = 0;

			this.init = function() {
				this.el = $('<div></div>').addClass('mapplic-legend');
				return this;
			}

			this.build = function(categories) {
				var s = this;
				$.each(categories, function(index, category) {
					if (category.legend == 'true') s.add(category);
				});
				if (this.nr > 0) this.el.appendTo(self.container.el);
			}

			this.add = function(group) {
				var toggle = this.newToggle(group, true);
				if (toggle) toggle.appendTo(this.el);
				else {
					var key = $('<span></span>').addClass('mapplic-legend-key');
					if (group.color) key.css('background-color', group.color);
					$('<span></span>').addClass('mapplic-legend-label').text(group.title).prepend(key).appendTo(this.el);
				}
				this.nr++;
			}

			this.toggle = function(group, state) {
				$('*[id="' + group + '"]', self.map).toggle(state);
				$('*[data-category*="' + group + '"]', self.map).each(function() {
					var attr = $(this).attr('data-category'); 
					if (attr == group) $(this).toggle(state);
					else { // multi-group support
						var groups = attr.split(','),
							show = false;
						groups.forEach(function(g) { if ($('.mapplic-toggle > input[data-group="' + g + '"]')[0] && $('.mapplic-toggle > input[data-group="' + g + '"]')[0].checked) show = true; });
						$(this).toggle(show);
					}
				});
			}

			this.newToggle = function(group, title) {
				var s = this,
					toggle = null;

				if (group.toggle == 'true') {
					toggle = $('<label class="mapplic-toggle"></label>');
					var input = $('<input type="checkbox" checked>').attr('data-group', group.id).appendTo(toggle);
					var circle = $('<span></span>').addClass('mapplic-toggle-circle').appendTo(toggle);
					if (title) $('<span></span>').addClass('mapplic-legend-label').text(group.title).appendTo(toggle);
					if (group.switchoff == 'true') input.prop('checked', false);
					if (group.color) circle.css('background-color', group.color);
					
					input.change(function() {
						$('.mapplic-toggle > input[data-group="' + group.id + '"]', self.el).prop('checked', this.checked);
						s.toggle(group.id, this.checked);
					});
				}
				return toggle;
			}

			this.applyToggles = function() {
				var s = this;
				$('.mapplic-toggle > input', self.el).each(function() {
					s.toggle($(this).attr('data-group'), this.checked);
				});
			}
		}

		// groups
		function Groups() {

			this.init = function() {}

			this.addGroups = function(groups) {
				if (groups) {
					$.each(groups, function(index, group) {
						self.g[group.id] = group;
						if (group.style && self.s[group.style] && self.s[group.style].base) group.color = self.s[group.style].base.fill; // overwrite color with style
					});
				}

				if (self.o.sidebar) self.sidebar.addCategories(groups);
			}
		}

		// directory
		function Directory() {
			this.dirs = [];
			this.filters = {};

			this.init = function() {
				var s = this,
					event = 'mapready';

				if (self.o.csv) event = 'csvready';

				self.el.on(event, function(e, self) {
					// dir
					$('.mapplic-dir:not(.mapplic-dir-results)').each(function() {
						var attribute = $(this).data('attribute'),
							pattern = $(this).data('pattern'),
							title = $(this).text();

						if (title) $('<h3><span>' + title + '</span></h3>').appendTo($(this).empty());
						s.getDirectory(attribute, pattern, attribute).appendTo($(this));

					});

					// filter
					$('.mapplic-dir-filter').each(function() {
						var el = $(this),
							attribute = el.data('attribute'),
							options = [];

						// generate options
						if ($(this).hasClass('mapplic-dir-filter-generate')) {
							$.each(self.l, function(id, location) {
								if (location[attribute]) {
									var atts = location[attribute].toString().split(',');
									atts.forEach(function(att) { if (options.indexOf(att) === -1) options.push(att); });
								}
							});

							options.forEach(function(option) {
								var text = option;

								if (attribute == 'category' && self.g[option]) text = self.g[option].title;
								$('<option></option>').attr('value', option).text(text).appendTo(el);
							});
						}

						// changed
						$(this).on('change', function() {
							if (this.value) s.filters[attribute] = this.value;
							else delete s.filters[attribute];

							s.search();
						});
					});
				});


				// search
				$('.mapplic-dir-search').keyup(function(e) {
					var val = $(this).val();

					if (val) s.filters['keyword'] = val;
					else delete s.filters['keyword'];

					s.search();

					if (e.keyCode == 13) $('.mapplic-dir-results li > a').filter(':first').click();
					else if (e.keyCode == 27) s.clearFilters();
				});

				// results
				var restitle = $('<h3><span>0</span> found</h3>').appendTo($('.mapplic-dir-results'));
				$('<ul></ul>').appendTo($('.mapplic-dir-results'));
				$('<button></button>').text('Clear').append(getIcon('icon-cross')).addClass('mapplic-dir-results-clear').appendTo(restitle).on('click', function() {
					s.clearFilters();
				});

				// list/grid
				var directories = $('.mapplic-dir-view').parent().find('.mapplic-dir');
				$('.mapplic-dir-view-list').click(function() {
					$(this).hide();
					$('.mapplic-dir-view-grid').show();
					directories.removeClass('mapplic-dir-grid');
				});
				$('.mapplic-dir-view-grid').click(function() {
					$(this).hide();
					$('.mapplic-dir-view-list').show();
					directories.addClass('mapplic-dir-grid');
				});

				return this;
			}

			this.getDirectory = function(attribute, pattern, sortby) {
				var s = this,
					dir = $('<ul></ul>'),
					regex = new RegExp(pattern, 'i');
				$.each(self.l, function(id, location) {
					if (attribute && pattern && !regex.test(location[attribute])) return true; // skip if no match
					if (String(location.hide) != 'true') dir.append(s.getItem(location));
				});

				if (sortby) this.sortby(dir, sortby);

				this.dirs.push(dir);

				// trigger event
				self.el.trigger('dirready', dir);

				return dir;
			}

			this.getItem = function(location) {
				if (!location.id) location = self.l[location];

				var item = $('<li></li>').addClass('mapplic-dir-item').attr('data-location', location.id);
				var link = $('<a></a>').attr('href', '#').click(function(e) {
					e.preventDefault();
					self.showLocation(location.id, 600);

					// scroll back to map on mobile
					if (($(window).width() < 668) && (location.action || self.o.action) != 'lightbox') {
						$('html, body').animate({
							scrollTop: self.container.el.offset().top
						}, 400);
					}
				}).appendTo(item);

				if (self.o.sortby) item.data('sort', location[self.o.sortby]);

				if (self.o.thumbholder) {
					var thumbnail = this.thumbnail(location.title, location.thumbnail);
					if (thumbnail) thumbnail.appendTo(link);
				}

				$('<h4></h4>').text(location.title).appendTo(link);
				$('<span></span>').html(location.about).addClass('mapplic-about').appendTo(link);
				if (location.color) item.css('border-color', location.color);

				location.list = item;

				return item;
			}

			this.thumbnail = function(name, field) {
				var elem = null;

				if (field) {
					if (field.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g)) elem = $('<img>').attr('src', field).attr('alt', name).addClass('mapplic-thumbnail');
					else elem = $('<div></div>').addClass('mapplic-thumbnail mapplic-thumbnail-placeholder').attr('aria-hidden', 'true').html(field);
				}
				else if (name) {
					var words = name.split(' '),
						text = '';

					if (words[0]) text += words[0][0];
					if (words[1]) text += words[1][0];
					elem = $('<div></div>').addClass('mapplic-thumbnail mapplic-thumbnail-placeholder').attr('aria-hidden', 'true').text(text.toUpperCase());
				}

				return elem;
			}

			this.search = function() {
				var s = this;

				$('.mapplic-dir-results ul').empty();

				if (self.o.highlight) {
					self.map.removeClass('mapplic-filtered');
					$('.mapplic-highlight', self.map).removeClass('mapplic-highlight');
				}

				$.each(self.l, function(i, location) {
					var matched = true; // matched false, current ||

					$.each(s.filters, function(attribute, filter) {
						var current = false;

						if (attribute == 'keyword') $.each(self.o.searchfields, function(i, field) { if (location[field] && !current) current = !(s.normalizeString(location[field]).indexOf(s.normalizeString(filter)) == -1); });
						else if (location[attribute] && location[attribute].indexOf(filter) != -1) current = true;

						matched = matched && current;
					});

					if (matched) {
						$('.mapplic-dir-item[data-location="' + location.id + '"]').clone(true).appendTo($('.mapplic-dir-results ul')); // results
						if (self.o.highlight && !$.isEmptyObject(s.filters) && location.el) location.el.addClass('mapplic-highlight'); // highlight
					}
				});

				s.sortby($('.mapplic-dir-results ul'), 'title'); // alphabetic sort by title

				if ($.isEmptyObject(s.filters)) {
					$('.mapplic-dir').show();
					$('.mapplic-dir-results').hide();
				}
				else {
					$('.mapplic-dir').hide();
					$('.mapplic-dir-results').show();
					if (self.o.highlight) self.map.addClass('mapplic-filtered');
				}

				$('.mapplic-dir-results h3 span').text($('.mapplic-dir-results .mapplic-dir-item').length); // count
			}

			this.clearFilters = function() {
				this.filters = {};
				$('.mapplic-dir-search').val('');
				$('.mapplic-dir-filter').val('');

				this.search();
			}

			this.normalizeString = function(s) {
				if (s) return s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
				else return '';
			}

			this.sort = function(dir, order) {
				if (order === undefined) order = 1;
				var items = dir.children('.mapplic-dir-item');

				items.sort(function(a, b) {
					var a = $(a).data('sort'),
						b = $(b).data('sort');
					if (isNaN(a) || isNaN(b)) {
						return (a < b) ? -1 * order : 1 * order;
					}
					else return (a - b) * order;
				}).appendTo(dir);
			}

			this.sortby = function(dir, attribute, order) {
				var s = this;

				if (order === undefined) order = 1;
				var items = dir.children('.mapplic-dir-item');
				items.each(function() {
					$(this).data('sort', s.normalizeString(self.l[$(this).data('location')][attribute]));
				});
				this.sort(dir, order);
			}			
		}

		// sidebar
		function Sidebar() {
			this.el = null;
			this.header = null;
			this.clear = null;
			this.input = null;
			this.list = null;
			this.tags = null;
			this.toggle = null;

			this.init = function() {
				var s = this;

				this.el = $('<div></div>').addClass('mapplic-sidebar').appendTo(self.el);

				if (self.o.filtersopened) this.el.addClass('mapplic-sidebar-header-opened');
				
				if (self.o.sidebartoggle) {
					self.el.addClass('mapplic-dynamic-sidebar');

					this.toggle = $('<button></button>').append(getIcon('icon-sidebar')).addClass('mapplic-button mapplic-sidebar-toggle').appendTo(self.container.el);
					this.toggle.on('click touchstart', function(e) {
						e.preventDefault();
						self.el.toggleClass('mapplic-hidden-sidebar');
						setTimeout(function() {
							var wr = self.container.el.width() / self.contentWidth,
								hr = self.container.el.height() / self.contentHeight;

							if (self.o.mapfill) {
								if (wr > hr) self.fitscale = wr;
								else self.fitscale = hr;
							}
							else {
								if (wr < hr) self.fitscale = wr;
								else self.fitscale = hr;
							}

							if (self.container.oldW != self.container.el.width() || self.container.oldH != self.container.el.height()) {

								self.container.oldW = self.container.el.width();
								self.container.oldH = self.container.el.height();

								if (self.scale*self.contentWidth < self.container.el.width()) self.moveTo(self.x, self.y, self.scale, 600);
							}

						}, 400);
					});
				}

				if (self.o.search) {
					this.header = $('<div></div>').addClass('mapplic-sidebar-header').append(getIcon('icon-magnifier')).appendTo(this.el);
					this.clear = $('<button></button>').addClass('mapplic-search-clear').append(getIcon('icon-cross')).appendTo(this.header);
					this.headerwrap = $('<div></div>').appendTo(this.header);

					this.input = $('<input>').attr({'type': 'text', 'spellcheck': 'false', 'placeholder': self.loc.search}).addClass('mapplic-search-input').keyup(function(e) {
						var val = $(this).val();

						if (val) self.directory.filters['keyword'] = val;
						else delete self.directory.filters['keyword'];

						s.el.toggleClass('mapplic-sidebar-header-opened', val.length < 1);

						s.search();

						if (e.keyCode == 13) $('.mapplic-list-container li > a').filter(':visible:first').click();
						else if (e.keyCode == 27) $(this).blur();
					});
					this.input.focus(function() {
						if ($(this).val().length < 1) s.el.addClass('mapplic-sidebar-header-opened');
					});

					$('body').click(function(e) {
						if (!$.contains(s.header[0], e.target) && s.header[0] != e.target) s.el.removeClass('mapplic-sidebar-header-opened');
					});

					this.input.appendTo(this.headerwrap);

					// clear search
					this.clear.on('click touchstart', function(e) {
						e.preventDefault();
						s.input.val('');
						s.tags.empty();
						if (s.tags.children().length < 1) s.el.removeClass('mapplic-sidebar-tagsrow');
						self.directory.filters = {};

						s.search();
					});

					this.toggle = $('<button></button>').append(getIcon('icon-filter')).addClass('mapplic-search-toggle').click(function(e) {
						e.preventDefault();
						s.el.toggleClass('mapplic-sidebar-header-opened');
					}).appendTo(this.headerwrap);

					// tags
					this.tags = $('<div></div>').addClass('mapplic-filter-tags').appendTo(this.headerwrap);

					// filters
					this.filter = $('<div></div>').addClass('mapplic-filter').appendTo(this.header);

					// dim
					this.dim = $('<div></div>').addClass('mapplic-sidebar-dim').click(function() { s.el.removeClass('mapplic-sidebar-header-opened'); }).appendTo(this.el);
				}
				else this.el.addClass('mapplic-sidebar-nosearch');

				// items
				var event = 'mapready';
				if (self.o.csv) event = 'csvready';

				self.el.on(event, function(e, self) {
					s.dir = self.directory.getDirectory().addClass('mapplic-list-container').appendTo(s.el);

					// alphabetic sort by title
					if (self.o.alphabetic) self.directory.sortby(s.dir, 'title');
				});

				if (self.o.searchdescription && self.o.searchfields.indexOf('description') === -1) self.o.searchfields.push('description');
			}

			this.addTag = function(item) {
				var s = this,
					categories = [];

				if (self.directory.filters['category']) categories = self.directory.filters['category'].split(',');

				if (!categories.includes(item.id)) {
					categories.push(item.id);
					self.directory.filters['category'] = categories.toString();

					this.el.addClass('mapplic-sidebar-tagsrow');

					var tag = $('<button></button>').addClass('mapplic-tag').text(item.title).attr('aria-label', self.loc.clearfilter + ': ' + item.title).prependTo(this.tags);
					$('<span></span>').appendTo(tag);
					if (item.color) tag.css('background-color', item.color);
					if (item.id) tag.attr('data-id', item.id);

					tag.click(function() {
						tag.remove();
						if (s.tags.children().length < 1) s.el.removeClass('mapplic-sidebar-tagsrow');
						if (self.directory.filters['category'] == item.id) delete self.directory.filters['category'];
						else if (self.directory.filters['category']) {
							categories = self.directory.filters['category'].split(',');
							var i = categories.indexOf(item.id);
							if (i > -1) {
								categories.splice(i, 1)
								self.directory.filters['category'] = categories.toString();
							}
						}
						s.search();
					}).appendTo(tag);

					s.search();
					this.el.removeClass('mapplic-sidebar-header-opened');
				}
			}

			this.addCategories = function(categories) {
				var s = this,
					list = $('<ul></ul>'),
					add = false;

				if (categories) {
					$.each(categories, function(index, category) {
						category.nr = 0;

						if (!(category.hide == 'true')) {
							var item = $('<li></li>').addClass('mapplic-list-category').attr('data-category', category.id);
							var link = $('<a></a>').attr('href', '#').prependTo(item);

							var thumbnail = self.directory.thumbnail(category.title, category.icon).appendTo(link);
							if (category.color && thumbnail) thumbnail.css({'background-color': category.color, 'border-color': category.color });

							var title = $('<h4></h4').text(category.title).appendTo(link);
							if (!category.about) title.addClass('mapplic-margin');
							else $('<span></span>').addClass('mapplic-about').html(category.about).appendTo(link);
							category.count = $('<span></span>').text('(0)').addClass('mapplic-list-count').appendTo(title);
							
							var toggle = self.legend.newToggle(category)
							if (toggle) toggle.appendTo(item);

							
							link.on('click', function(e) {
								e.preventDefault();
								if (category.nr < 1 && toggle) $('> input', toggle).trigger('click');
								else {
									//s.input.val('');
									s.addTag(category);
								}
							});

							category.list = item;
							item.appendTo(list);
							add = true;
						}
					});

					if (add) {
						s.el.addClass('mapplic-sidebar-filterable');
						
						//$('<h5></h5>').text('CATEGORIES').appendTo(s.filter);
						
						list.appendTo(s.filter);
					}
				}
			}

			this.countCategory = function() {
				$.each(self.g, function(i, group) {
					if (group.count) {
						group.count.text('(' + group.nr + ')');
						if (group.nr < 1) group.count.hide();
						else group.count.show();
					}
				});
			}

			// search
			this.search = function() {
				var s = this;

				if (self.o.highlight) {
					self.map.removeClass('mapplic-filtered');
					$('.mapplic-highlight', self.map).removeClass('mapplic-highlight');
				}

				$.each(self.l, function(i, location) {
					var matched = true; // matched false, current ||

					$.each(self.directory.filters, function(attribute, filter) {
						var current = false;

						if (attribute == 'keyword') $.each(self.o.searchfields, function(i, field) { if (location[field] && !current) current = !(self.directory.normalizeString(location[field]).indexOf(self.directory.normalizeString(filter)) == -1); });
						else if (location.category && attribute == 'category') {
							var categories = location.category;
							if (typeof categories == 'string') categories = categories.split(',');

							categories.forEach(function(category) {
								if (self.directory.filters['category'].split(',').includes(category)) current = true;
							});
						}
						else if (location[attribute] && location[attribute].indexOf(filter) != -1) current = true;

						matched = matched && current;
					});

					var item = $('.mapplic-dir-item[data-location="' + location.id + '"]', self.el);
					if (matched) {
						item.show();
						if (self.o.highlight && !$.isEmptyObject(self.directory.filters) && location.el) location.el.addClass('mapplic-highlight'); // highlight
					}
					else item.hide();
				});

				if (!$.isEmptyObject(self.directory.filters)) {
					if (self.o.highlight) self.map.addClass('mapplic-filtered');
					self.el.addClass('mapplic-search-active');
				}
				else self.el.removeClass('mapplic-search-active');
			}
		}

		// developer tools
		function DevTools() {
			this.el = null;

			this.init = function() {
				this.el = $('<div></div>').addClass('mapplic-coordinates').appendTo(self.container.el);
				this.el.append('x: ');
				$('<code></code>').addClass('mapplic-coordinates-x').appendTo(this.el);
				this.el.append(' y: ');
				$('<code></code>').addClass('mapplic-coordinates-y').appendTo(this.el);

				$('.mapplic-layer', self.map).on('mousemove', function(e) {
					var x = (e.pageX - self.map.offset().left) / self.map.width() / self.scale,
						y = (e.pageY - self.map.offset().top) / self.map.height() / self.scale;
					$('.mapplic-coordinates-x').text(parseFloat(x).toFixed(4));
					$('.mapplic-coordinates-y').text(parseFloat(y).toFixed(4));
				});

				return this;
			}
		}

		// clear button
		function ClearButton() {
			this.el = null;
			
			this.init = function() {
				this.el = $('<button></button>').text(self.loc.resetzoom).append(getIcon('icon-reset')).addClass('mapplic-button mapplic-clear-button').appendTo(self.container.el);

				if (!self.o.zoombuttons) this.el.css('bottom', '0');

				this.el.on('click touchstart', function(e) {
					e.preventDefault();
					self.hideLocation();
					self.moveTo(0.5, 0.5, self.fitscale, 400);
				});

				return this;
			}

			this.update = function(scale) {
				if (scale == self.fitscale) this.el.stop().fadeOut(200);
				else this.el.stop().fadeIn(200);
			}
		}

		// zoom buttons
		function ZoomButtons() {
			this.el = null;
		
			this.init = function() {
				this.el = $('<div></div>').addClass('mapplic-zoom-buttons').appendTo(self.container.el);

				// zoom-in button
				this.zoomin = $('<button></button>').attr('aria-label', self.loc.zoomin).append(getIcon('icon-plus')).addClass('mapplic-button mapplic-zoomin-button').appendTo(this.el);
				this.zoomin.on('click touchstart', function(e) {
					e.preventDefault();
					self.container.stopMomentum();

					var scale = self.scale;
					self.scale = normalizeScale(scale + scale * 0.8);

					self.x = normalizeX(self.x - (self.container.el.width() / 2 - self.x) * (self.scale / scale - 1));
					self.y = normalizeY(self.y - (self.container.el.height() / 2 - self.y) * (self.scale / scale - 1));

					zoomTo(self.x, self.y, self.scale, 400, 'ease');
				});

				// zoom-out button
				this.zoomout = $('<button></button>').attr('aria-label', self.loc.zoomout).append(getIcon('icon-minus')).addClass('mapplic-button mapplic-zoomout-button').appendTo(this.el);
				this.zoomout.on('click touchstart', function(e) {
					e.preventDefault();
					self.container.stopMomentum();

					var scale = self.scale;
					self.scale = normalizeScale(scale - scale * 0.4);

					self.x = normalizeX(self.x - (self.container.el.width() / 2 - self.x) * (self.scale / scale - 1));
					self.y = normalizeY(self.y - (self.container.el.height() / 2 - self.y) * (self.scale / scale - 1));

					zoomTo(self.x, self.y, self.scale, 400, 'ease');
				});

				return this;
			}

			this.update = function(scale) {
				this.zoomin.removeAttr('disabled');
				this.zoomout.removeAttr('disabled');
				if (scale == self.fitscale) this.zoomout.attr('disabled','disabled');
				else if (scale == 1) this.zoomin.attr('disabled','disabled');
			}
		}

		// fullscreen
		function Fullscreen() {
			this.el = null;
			this.fsh = null; // fullscreen placeholder
			this.esh = null; // element placeholder

			this.init = function() {
				var s = this;

				this.fph = $('<div></div>').addClass('mapplic-fsh').prependTo('body');
				this.eph = $('<div></div>').addClass('mapplic-esh').insertBefore(self.el);

				// fullscreen button
				this.el = $('<button></button>').append(getIcon('icon-fullscreen')).append(getIcon('icon-fullscreen-exit')).addClass('mapplic-button mapplic-fullscreen-button').click(function(e) {
					self.el.toggleClass('mapplic-fullscreen');

					if (self.el.hasClass('mapplic-fullscreen')) self.el.insertBefore(s.fph);
					else self.el.insertBefore(s.eph);

					$(document).resize();
				}).appendTo(self.container.el);

				// esc key
				$(document).on('keyup.mapplic', function(e) {
					if ((e.keyCode === 27) && $('.mapplic-fullscreen')[0]) {
						$('.mapplic-element.mapplic-fullscreen').removeClass('mapplic-fullscreen');
						self.el.insertBefore(s.eph);
						$(document).resize();
					}
				});
			}
		}

		// styles
		function Styles() {
			this.data = null;

			this.init = function(data) {
				this.data = data;
				this.process(data);
				return this;
			}

			this.process = function(styles) {
				var css = '';

				// basecolor
				if (self.o.basecolor) css += this.rule('.mapplic-fullscreen, .mapplic-legend', 'background-color', self.o.basecolor);

				// bgcolor
				if (self.o.bgcolor) {
					css += this.rule(
						'.mapplic-button, .mapplic-tooltip-close .mapplic-icon, .mapplic-levels-select, .mapplic-levels button, .mapplic-level-switcher button.mapplic-selected, .mapplic-element *::-webkit-scrollbar-track, .mapplic-list-container, .mapplic-filter, .mapplic-sidebar-header, .mapplic-tooltip-wrap, .mapplic-lightbox, .mapplic-toggle:before',
						'background-color',
						self.o.bgcolor
					);
					css += this.rule('.mapplic-legend-key, .mapplic-element *::-webkit-scrollbar-thumb', 'border-color', self.o.bgcolor);
					css += this.rule('.mapplic-tooltip:after', 'border-color', self.o.bgcolor + ' transparent transparent transparent !important');
					css += this.rule('.mapplic-tooltip-bottom.mapplic-tooltip:after', 'border-color', 'transparent transparent ' + self.o.bgcolor + ' transparent !important');
				}

				// bgcolor2
				if (self.o.bgcolor2) {
					css += this.rule(
						'.mapplic-thumbnail-placeholder, .mapplic-level-switcher button, .mapplic-sidebar .mapplic-dir-item > a:hover, .mapplic-sidebar-header-opened.mapplic-sidebar-filterable .mapplic-search-toggle, .mapplic-sidebar .mapplic-dir-item > a:focus, .mapplic-sidebar .mapplic-dir-item.mapplic-active > a, .mapplic-list-category > a:hover, .mapplic-zoom-buttons button:disabled, .mapplic-levels button:disabled',
						'background-color',
						self.o.bgcolor2
					);
					css += this.rule('a.mapplic-zoomin-button', 'border-color', self.o.bgcolor2);
				}

				// headingcolor
				if (self.o.headingcolor) {
					css += this.rule('.mapplic-search-input, .mapplic-level-switcher button.mapplic-selected, .mapplic-list-category > a, .mapplic-tooltip-title, .mapplic-lightbox-title, .mapplic-sidebar .mapplic-dir-item h4, .mapplic-element strong, .mapplic-levels-select, .mapplic-list-category h4', 'color', self.o.headingcolor);
					css += this.rule('.mapplic-icon', 'fill', self.o.headingcolor);
				}

				// textcolor
				if (self.o.textcolor) css += this.rule('.mapplic-element, .mapplic-element a, .mapplic-level-switcher button, .mapplic-about, .mapplic-list-category > a .mapplic-list-count, .mapplic-search-input::placeholder, .mapplic-lightbox-description', 'color', self.o.textcolor);

				// accentcolor
				if (self.o.accentcolor) css += this.rule('.mapplic-popup-link, .mapplic-accentcolor', 'background-color', self.o.accentcolor);

				if (styles) {
					self.s = [];

					styles.forEach(function(s) {
						// styles object
						self.s[s.class] = s;

						if (s.base) {
							css += '.' + s.class + '.mapplic-clickable:not(g), g.' + s.class + '.mapplic-clickable > * { ';
							$.each(s.base, function(prop, val) { css += prop + ': ' + val + '; '; });
							css += '}\n';

							css += '.' + s.class + '.mapplic-pin {\n';
							$.each(s.base, function(prop, val) {
								css += '	background-color: ' + val + ';\n';
								css += '	border-color: ' + val + ';\n';
							});
							css += '}\n\n';
						}

						if (s.hover) {
							css += '.' + s.class + '.mapplic-highlight:not(g), g.' + s.class + '.mapplic-highlight > *, .' + s.class + '.mapplic-clickable:not(g):hover, g.' + s.class + '.mapplic-clickable:hover > * { ';
							$.each(s.hover, function(prop, val) { css += prop + ': ' + val + '; ' });
							css += '}\n';

							css += '.' + s.class + '.mapplic-pin.mapplic-highlight, .' + s.class + '.mapplic-pin:hover {\n';
							$.each(s.hover, function(prop, val) {
								css += '	background-color: ' + val + ';\n';
								css += '	border-color: ' + val + ';\n';
							});
							css += '}\n\n';
						}

						if (s.active) {
							css += '.'+ s.class + '.mapplic-active:not(g), g.' + s.class + '.mapplic-active > * { ';
							$.each(s.active, function(prop, val) { css += prop + ': ' + val + ' !important; ' });
							css += '}\n';

							css += '.' + s.class + '.mapplic-pin.mapplic-active {\n';
							$.each(s.active, function(prop, val) {
								css += '	background-color: ' + val + ';\n';
								css += '	border-color: ' + val + ';\n';
							});
							css += '}\n\n';
						}
					});
				}

				if (self.o.customcss) css += self.o.customcss;
				
				var style = $('<style></style>').html(css).appendTo('body');
			}

			this.rule = function(selector, attribute, value) {
				var css = selector + ' {\n';
				css += '	' + attribute + ': ' + value + ';\n';
				css += '}\n\n';

				return css;
			}
		}

		function Container() {
			this.el = null;
			this.oldW = 0;
			this.oldH = 0;
			this.position = {x: 0, y: 0},
			this.momentum = null;
			this.levels = {};

			this.init = function() {
				this.el = $('<div></div>').addClass('mapplic-container').appendTo(self.el);
				self.map = $('<div></div>').addClass('mapplic-map').appendTo(this.el);

				self.map.css({
					'width': self.contentWidth,
					'height': self.contentHeight
				});

				return this;
			}

			// returns container height (px)
			this.calcHeight = function(v) {
				var val = Math.min(Math.max(this.getHeight(v), this.getHeight(self.o.minheight)), this.getHeight(self.o.maxheight));

				if ($.isNumeric(val)) return val;
				else return false;
			}

			this.getHeight = function(v) {
				var val = v.toString().replace('px', '');

				if ((val == 'auto') && (self.container.el))  val = self.container.el.width() * self.contentHeight / self.contentWidth; 
				else if (val.slice(-1) == '%') val = $(window).height() * val.replace('%', '') / 100;

				return val;
			}

			this.resetZoom = function() {
				var init = self.l['init'];
				if (init) {
					self.switchLevel(init.level);
					if (!self.bboxZoom(init.el)) self.zoomLocation(init);
				}
				else self.moveTo(0.5, 0.5, self.fitscale, 0);
			}

			this.revealChild = function(parent) {
				$('.mapplic-pin[data-location^=' + parent.id + '-]', self.map).addClass('mapplic-revealed');
				$('.mapplic-map-image [id^=' + parent.id + '-]', self.map).addClass('mapplic-revealed');
			}

			this.revealZoom = function(zoom) {
				$('.mapplic-pin[data-reveal]', self.map).each(function() {
					var reveal = $(this).data('reveal');
					if (zoom * self.o.maxscale >= reveal) $(this).addClass('mapplic-revealed');
					else $(this).removeClass('mapplic-revealed');
				});
			}

			this.coverAll = function() {
				$('.mapplic-revealed', self.map).removeClass('mapplic-revealed');
			}

			this.stopMomentum = function() {
				cancelAnimationFrame(this.momentum);
				if (this.momentum != null) {
					self.x = this.position.x;
					self.y = this.position.y;
				}
				this.momentum = null;
			}

			this.addLevelSwitcher = function() {
				if (self.data.levels.length > 1) {
					var control = $('<div></div>').addClass('mapplic-level-switcher');
					self.data.levels.forEach(function(level, i) {
						var button = $('<button></button>').attr('data-level', level.id).text(level.title).prependTo(control).click(function(e) {
							e.preventDefault();
							self.switchLevel(level.id);
						});
						if (level.show) button.addClass('mapplic-selected');
					});

					this.el.append(control);

					self.el.on('levelswitched', function(e, target) {
						$('button', control).removeClass('mapplic-selected');
						$('button[data-level="' +  target + '"]', control).addClass('mapplic-selected');
					});
				}
			}

			this.addControls = function() {
				self.map.addClass('mapplic-zoomable');

				document.ondragstart = function() { return false; } // IE drag fix

				// momentum
				var friction = 0.85,
					mouse = {x: 0, y: 0},
					pre = {x: 0, y: 0},
					previous = {x: this.position.x, y: this.position.y},
					velocity = {x: 0, y: 0};

				var s = this;
				var momentumStep = function() {
					s.momentum = requestAnimationFrame(momentumStep);

					if (self.map.hasClass('mapplic-dragging')) {
						pre.x = previous.x;
						pre.y = previous.y;

						previous.x = s.position.x;
						previous.y = s.position.y;

						s.position.x = mouse.x;
						s.position.y = mouse.y;
						
						velocity.x = previous.x - pre.x;
						velocity.y = previous.y - pre.y;
					}
					else {
						s.position.x += velocity.x;
						s.position.y += velocity.y;
						
						velocity.x *= friction;
						velocity.y *= friction;

						if (Math.abs(velocity.x) + Math.abs(velocity.y) < 0.1) {
							s.stopMomentum();
							self.x = s.position.x;
							self.y = s.position.y;
						}
					}
					s.position.x = normalizeX(s.position.x);
					s.position.y = normalizeY(s.position.y);

					zoomTo(s.position.x, s.position.y);
				}

				// drag & drop
				$('.mapplic-map-image', self.map).on('mousedown', function(e) {
					self.dragging = false;
					self.map.addClass('mapplic-dragging');
					
					s.stopMomentum();
					var initial = {
						x: e.pageX - self.x,
						y: e.pageY - self.y
					};

					mouse.x = normalizeX(e.pageX - initial.x);
					mouse.y = normalizeY(e.pageY - initial.y);
					momentumStep();

					self.map.on('mousemove', function(e) {
						self.dragging = true;

						mouse.x = normalizeX(e.pageX - initial.x);
						mouse.y = normalizeY(e.pageY - initial.y);
					});
				
					$(document).on('mouseup.mapplic', function() {
						$(document).off('mouseup.mapplic');
						self.map.off('mousemove');
						self.map.removeClass('mapplic-dragging');
					});
				});

				// mousewheel
				if (self.o.mousewheel) $('.mapplic-map-image', self.el).on('mousewheel DOMMouseScroll', self.mouseWheel);

				// touch
				var init1 = null,
					init2 = null,
					initD = 0,
					initScale = null;

				$('.mapplic-map-image', self.map).on('touchstart', function(e) {
					e.preventDefault();
					var eo = e.originalEvent;

					if (eo.touches.length == 1) {
						self.map.addClass('mapplic-dragging');
						self.dragging = false;

						s.stopMomentum();
						
						init1 = {
							x: eo.touches[0].pageX - self.x,
							y: eo.touches[0].pageY - self.y
						};

						self.firstcoord = { x: eo.touches[0].pageX, y: eo.touches[0].pageY };

						mouse = {
							x: normalizeX(eo.touches[0].pageX - init1.x),
							y: normalizeY(eo.touches[0].pageY - init1.y)
						};
						momentumStep();

						self.map.on('touchmove', function(e) {
							e.preventDefault();
							self.dragging = true;
							var eo = e.originalEvent;

							if (eo.touches.length == 1) {
								mouse.x = normalizeX(eo.touches[0].pageX - init1.x);
								mouse.y = normalizeY(eo.touches[0].pageY - init1.y);

								self.lastcoord = { x: eo.touches[0].pageX, y: eo.touches[0].pageY };
							}
							else if (eo.touches.length > 1) {
								var pos = {
									x: (eo.touches[0].pageX + eo.touches[1].pageX)/2,
									y: (eo.touches[0].pageY + eo.touches[1].pageY)/2
								}

								var dist = Math.sqrt(Math.pow(eo.touches[0].pageX - eo.touches[1].pageX, 2) + Math.pow(eo.touches[0].pageY - eo.touches[1].pageY, 2)) / initD;

								var scale = self.scale;
								self.scale = normalizeScale(initScale * dist);

								self.x = normalizeX(self.x - (pos.x - self.container.el.offset().left - self.x) * (self.scale/scale - 1));
								self.y = normalizeY(self.y - (pos.y - self.container.el.offset().top - self.y) * (self.scale/scale - 1));

								zoomTo(self.x, self.y, self.scale, 100, 'ease');
							}
						});

						$(document).on('touchend.mapplic', function(e) {
							e.preventDefault();
							var dragback = null,
								eo = e.originalEvent;

							if (eo.touches.length == 0) {
								clearTimeout(dragback);
								$(document).off('touchend.mapplic');
								self.map.off('touchmove');
								self.map.removeClass('mapplic-dragging');
								self.dragging = false;
							}
							else if (eo.touches.length == 1) {
								dragback = setTimeout(function() {
									self.map.addClass('mapplic-dragging');
									self.dragging = true;

									s.stopMomentum();
									init1 = {
										x: eo.touches[0].pageX - self.x,
										y: eo.touches[0].pageY - self.y
									};

									mouse = {
										x: normalizeX(eo.touches[0].pageX - init1.x),
										y: normalizeY(eo.touches[0].pageY - init1.y)
									};

									momentumStep();
								}, 60);
							}
						});
					}


					// pinch
					else if (eo.touches.length == 2) {
						self.dragging = true;
						self.map.addClass('mapplic-dragging');

						s.stopMomentum();

						init2 = { x: eo.touches[1].pageX - self.x, y: eo.touches[1].pageY - self.y };
						initD = Math.sqrt(Math.pow(init1.x - init2.x, 2) + Math.pow(init1.y - init2.y, 2));
						initScale = self.scale;

					}
				});
			}
		}

		// functions
		var processData = function(data) {
			self.data = data;
			self.g = {};
			self.l = {};
			var shownLevel = null;

			// extend options
			self.o = $.extend(self.o, data);
			$.each(self.el.data(), function(i, v) { self.o[i] = v; });
			self.o.zoommargin = parseFloat(self.o.zoommargin);
			self.o.maxscale = parseFloat(self.o.maxscale);

			// more text
			if (self.o.moretext) self.loc.more = self.o.moretext;

			// height of container
			if (self.el.data('height')) self.o.height = self.el.data('height');
			self.contentWidth = parseFloat(data.mapwidth);
			self.contentHeight = parseFloat(data.mapheight);

			// limiting to scale 1
			self.contentWidth = self.contentWidth * self.o.maxscale;
			self.contentHeight = self.contentHeight * self.o.maxscale;

			// create container
			self.container = new Container().init();

			// styles
			self.styles = new Styles().init(self.o.styles);

			// create minimap
			if (self.o.minimap) self.minimap = new Minimap().init();

			// create legend
			self.legend = new Legend().init();
			self.legend.build(data.groups || data.categories);

			// directory
			self.directory = new Directory().init();

			// create sidebar
			if (self.o.sidebar) {
				self.sidebar = new Sidebar();
				self.sidebar.init();
			}
			else self.container.el.css('width', '100%');

			// groups
			self.groups = new Groups();
			self.groups.addGroups(data.groups || data.categories);

			// trigger event
			self.el.trigger('mapstart', self);

			// iterate through levels
			var levelnr = 0,
				toload = 0;

			if (data.levels) {
				$.each(data.levels, function(index, level) {
					var source = level.map,
						extension = source.substr((source.lastIndexOf('.') + 1)).toLowerCase();

					// new map layer
					var layer = $('<div></div>').addClass('mapplic-layer').attr('data-floor', level.id).appendTo(self.map);
					switch (extension) {

						// image formats
						case 'jpg': case 'jpeg': case 'png': case 'gif':
							var mapimage = $('<div></div>').addClass('mapplic-map-image').appendTo(layer);
							$('<img>').attr('src', source).attr('aria-hidden', 'true').addClass('mapplic-map-image').appendTo(mapimage);
							if (level.locations) self.addLocations(level.locations, level.id);
							break;

						// vector format
						case 'svg':
							toload++;
							var mapimage = $('<div></div>').addClass('mapplic-map-image').appendTo(layer);

							$('<div></div>').load(source, function() {

								// sanitize svg - XSS protection
								$('script', this).remove();
								mapimage.html($(this).html());

								// illustrator duplicate id fix
								$(self.o.selector, mapimage).each(function() {
									var id = $(this).attr('id');
									if (id) $(this).attr('id', id.replace(/_[1-9]+_$/g, ''));
								});

								// add locations
								if (level.locations) self.addLocations(level.locations, level.id);

								// click event
								$(self.o.selector, mapimage).on('click touchend', function(e) {
									var shift = Math.abs(self.firstcoord.x - self.lastcoord.x) + Math.abs(self.firstcoord.y - self.lastcoord.y);
									if (!self.dragging || shift < 4) self.showLocation($(this).attr('id'), 600);
								});

								// autopopulate
								if (self.o.autopopulate) {
									var ap = [];
									$(self.o.selector, mapimage).each(function() {
										var id = $(this).attr('id'),
											location = self.l[id];

										if (!location) {
											location = {
												id: id,
												title: id.charAt(0).toUpperCase() + id.slice(1),
												pin: 'hidden'
											};
											ap.push(location);
										}
									});
									self.addLocations(ap, level.id);
								}

								// trigger event(s)
								self.el.trigger('svgloaded', [mapimage, level.id]);
								toload--;
								if (toload == 0) mapReady();
							});
							break;

						// others 
						default:
							alert('File type ' + extension + ' is not supported!');
					}

					// create new minimap layer
					if (self.minimap) self.minimap.addLayer(level);

					// shown level
					if (!shownLevel || level.show)	shownLevel = level.id;

					levelnr++;
				});
			}

			// COMPONENTS
			self.tooltips = Array();
			if (self.o.lightbox && $.magnificPopup) self.lightbox = new Lightbox().init();
			if (self.o.hovertip) self.hovertip = new HoverTooltip().init();
			if (self.o.external) self.external = new External().init();
			if (self.o.clearbutton) self.clearbutton = new ClearButton().init();
			if (self.o.zoombuttons) self.zoombuttons = new ZoomButtons().init();
			if (self.o.fullscreen) self.fullscreen = new Fullscreen().init();
			if (self.o.developer) self.devtools = new DevTools().init();

			self.container.addLevelSwitcher();
			self.switchLevel(shownLevel);

			if (self.o.portrait === 'true') self.o.portrait = true;

			// resize
			$(window).resize(function() {
				if (self.o.portrait == true || $.isNumeric(self.o.portrait) && self.el.width() < parseFloat(self.o.portrait)) {
					self.el.addClass('mapplic-portrait');
					if (self.el.hasClass('mapplic-fullscreen')) self.container.el.height($(window).height());
					else self.container.el.height(self.container.calcHeight(self.o.height));
				}
				else {
					self.el.removeClass('mapplic-portrait');
					self.container.el.height('100%');
					self.el.height(self.container.calcHeight(self.o.height));
				}

				var wr = self.container.el.width() / self.contentWidth,
					hr = self.container.el.height() / self.contentHeight;

				if (self.o.mapfill) {
					if (wr > hr) self.fitscale = wr;
					else self.fitscale = hr;
				}
				else {
					if (wr < hr) self.fitscale = wr;
					else self.fitscale = hr;
				}

				if (self.container.oldW != self.container.el.width() || self.container.oldH != self.container.el.height()) {

					self.container.oldW = self.container.el.width();
					self.container.oldH = self.container.el.height();

					self.container.resetZoom();
				}
			}).resize();

			// deeplinking
			if (self.o.deeplinking) {
				if (history.pushState && (typeof URL == 'function')) self.deeplinking = new Deeplinking();
				else self.deeplinking = new DeeplinkingHash();

				self.deeplinking.init();
			}

			// trigger event
			if (toload == 0) mapReady();

			// controls
			if (self.o.zoom) self.container.addControls();
			self.firstcoord = self.lastcoord = {};

			// link to locations
			$(document).on('click', '.mapplic-location', function(e) {
				e.preventDefault();
				self.showLocation($(this).attr('href').substr(1), 400);
				$('html, body').animate({ scrollTop: self.container.el.offset().top }, 400);
			});
		}

		var mapReady = function() {
			// separate location array
			self.addLocations(self.data.locations);

			// apply toggle
			self.legend.applyToggles();

			// CSV support
			if (self.o.csv) { 
				if (typeof Papa === 'undefined') {
					console.warn('CSV parser missing. Please make sure the library is loaded.');
				}
				else {
					Papa.parse(self.o.csv, {
						header: true,
						download: true,
						encoding: "UTF-8",
						skipEmptyLines: true,
						complete: function(results, file) {
							self.addLocations(results.data);
							$('.mapplic-pin', self.map).css({ 'transform': 'scale(' + 1/self.scale + ')' });
							if (self.deeplinking) self.deeplinking.check(0);

							self.el.trigger('csvready', self);
						}
					});
				}
			}

			self.container.resetZoom();
			if (self.deeplinking) self.deeplinking.check(0);

			// landmark mode
			if (self.el.data('landmark')) self.o.landmark = self.el.data('landmark');
			if (self.o.landmark) {
				// Custom settings
				self.o.sidebar = false;
				self.o.zoombuttons = false;
				self.o.deeplinking = false;
				self.showLocation(self.o.landmark, 0, true);
			}

			// trigger event
			self.el.trigger('mapready', self);
		}

		/* PRIVATE METHODS */

		// Web Mercator (EPSG:3857) lat/lng projection
		var latlngToPos = function(lat, lng) {
			var deltaLng = self.data.rightLng - self.data.leftLng,
				bottomLatDegree = self.data.bottomLat * Math.PI / 180,
				mapWidth = ((self.data.mapwidth / deltaLng) * 360) / (2 * Math.PI),
				mapOffsetY = (mapWidth / 2 * Math.log((1 + Math.sin(bottomLatDegree)) / (1 - Math.sin(bottomLatDegree))));

			lat = lat * Math.PI / 180;

			return {
				x: ((lng - self.data.leftLng) * (self.data.mapwidth / deltaLng)) / self.data.mapwidth,
				y: (self.data.mapheight - ((mapWidth / 2 * Math.log((1 + Math.sin(lat)) / (1 - Math.sin(lat)))) - mapOffsetY)) / self.data.mapheight
			};
		}

		var estimatedPosition = function(element) {
			if (!element || !(element[0] instanceof SVGElement)) return false;

			var	bbox = element[0].getBBox();

			var	padding = 40,
				wr = self.container.el.width() / (bbox.width + padding),
				hr = self.container.el.height() / (bbox.height + padding);

			return {
				x: (bbox.x + bbox.width/2) / self.contentWidth * self.o.maxscale,
				y: (bbox.y + bbox.height/2) / self.contentHeight * self.o.maxscale,
				scale: Math.min(wr, hr) / self.o.maxscale
			}
		}

		var getIcon = function(name) {
			return '<svg class="mapplic-icon mapplic-' + name + '" aria-hidden="true"><use xlink:href="' + self.loc.iconfile + '#' + name + '"></use></svg>';
		}

		// normalizing x, y and scale
		var normalizeX = function(x) {
			var minX = (self.container.el.width() - self.contentWidth * self.scale).toFixed(4);
			if (minX < 0) {
				if (x > self.o.zoommargin) x = self.o.zoommargin;
				else if (x < minX - self.o.zoommargin) x = minX - self.o.zoommargin;
			}
			else x = minX/2;

			return x;
		}

		var normalizeY = function(y) {
			var minY = (self.container.el.height() - self.contentHeight * self.scale).toFixed(4);
			if (minY < 0) {
				if (y > self.o.zoommargin) y = self.o.zoommargin;
				else if (y < minY - self.o.zoommargin) y = minY - self.o.zoommargin;
			}
			else y = minY/2;

			return y;
		}

		var normalizeScale = function(scale) {
			if (self.fitscale > 1) return self.fitscale; // no zoom

			if (scale <= self.fitscale) scale = self.fitscale;
			else if (scale > 1) scale = 1;

			// zoom timeout
			clearTimeout(self.zoomTimeout);
			self.zoomTimeout = setTimeout(function() {
				if (self.zoombuttons) self.zoombuttons.update(scale);
				if (self.clearbutton) self.clearbutton.update(scale);
				if (scale == self.fitscale) {
					self.container.coverAll();
					if (self.o.closezoomout) self.hideLocation();
				}
				self.container.revealZoom(scale);
			}, 200);

			return scale;
		}

		var moveTimeout = null;

		var zoomTo = function(x, y, scale, d) {
			d = typeof d !== 'undefined' ? d/1000 : 0;

			// move class
			self.el.addClass('mapplic-move');
			clearTimeout(moveTimeout);
			moveTimeout = setTimeout(function() {
				self.el.removeClass('mapplic-move');
				self.el.trigger('positionchanged', location);
			}, 400);

			// transforms
			self.map.css({
				'transition': 'transform ' + d + 's',
				'transform': 'translate(' + x.toFixed(3) + 'px ,' + y.toFixed(3) + 'px) scale(' + self.scale.toFixed(3) + ')'
			});

			if (scale) {
				$('.mapplic-pin, .mapplic-tooltip', self.map).css({
					'transition': 'transform ' + d + 's',
					'transform': 'scale(' + 1/scale + ')'
				});
			}

			if (self.minimap) self.minimap.update(x, y);

			// trigger event
			self.el.trigger('positionchanged', location);
		}

		var replaceVars = function(template, location) {
			template = template.replace(/\{\{([^}]+)\}\}/g, function (match) {
				match = match.slice(2, -2);
				var sub = match.split('.');
				if (sub.length > 1) {
					var temp = location;
					sub.forEach(function (item) {
						if (!temp[item]) {
							temp = '{{' + match + '}}';
							return;
						}
						temp = temp[item];
					});
					return temp;
				}
				else {
					if (!location[match]) return '{{' + match + '}}';
					return location[match];
				}
			});
			return template;
		}


		/* PUBLIC METHODS */
		var levelTimeout = null;
		self.switchLevel = function(target) {
			// no such layer
			if (!target) return;

			var layer = $('.mapplic-layer[data-floor="' + target + '"]', self.map);

			// target layer is already active
			if (layer.hasClass('mapplic-visible')) return;

			// show target layer
			layer.removeClass('mapplic-hidden');

			setTimeout(function() {
				var old = $('.mapplic-layer.mapplic-visible', self.map).removeClass('mapplic-visible');
				layer.addClass('mapplic-visible');
				
				clearTimeout(levelTimeout);
				levelTimeout = setTimeout(function() { 
					$('.mapplic-layer:not([data-floor="' + target + '"])', self.map).addClass('mapplic-hidden');
				}, 300);

				// slide animation
				if (self.o.animations) {
					var found = false;
					$('.mapplic-layer', self.map).each(function() {
						if ($(this).data('floor') == target) {
							$(this).removeClass('mapplic-layer-up').removeClass('mapplic-layer-down');
							found = true;
						}
						else if (found) $(this).addClass('mapplic-layer-up');
						else $(this).addClass('mapplic-layer-down');
					});
				}
			}, 1);

			// show target minimap layer
			if (self.minimap) self.minimap.show(target);

			self.level = target;

			// trigger event
			self.el.trigger('levelswitched', target);
		}

		self.mouseWheel = function(e, delta) {
			e.preventDefault();
			self.container.stopMomentum();

			var scale = self.scale;

			self.scale = normalizeScale(scale + scale * delta / 5);

			self.x = normalizeX(self.x - (e.pageX - self.container.el.offset().left - self.x) * (self.scale/scale - 1));
			self.y = normalizeY(self.y - (e.pageY - self.container.el.offset().top - self.y) * (self.scale/scale - 1));

			zoomTo(self.x, self.y, self.scale, 200, 'ease');
		}

		self.addTooltip = function(location, check) {
			var tooltip = new Tooltip().init(location, check);
			self.tooltips.push(tooltip);

			return tooltip.wrap[0];
		}

		self.closeTooltips = function() {
			self.tooltips.forEach(function(t, i) {
				t.hide();
				self.tooltips.splice(i, 1);
			});
		}

		self.moveTo = function(x, y, s, duration, ry) {
			duration = typeof duration !== 'undefined' ? duration : 400;
			ry = typeof ry !== 'undefined' ? ry : 0.5;
			s = typeof s !== 'undefined' ? s : self.scale/self.fitscale;

			self.container.stopMomentum();

			self.scale = normalizeScale(s);
			self.x = normalizeX(self.container.el.width() * 0.5 - self.scale * self.contentWidth * x);
			self.y = normalizeY(self.container.el.height() * ry - self.scale * self.contentHeight * y);

			zoomTo(self.x, self.y, self.scale, duration);
		}

		self.bboxZoom = function(element) {
			var pos = estimatedPosition(element);
			if (!pos) return false;

			self.moveTo(pos.x, pos.y, pos.scale, 600);
			return true;
		}

		// adding locations
		self.addLocations = function(locations, levelid) {
			$.each(locations, function(index, location) {
				if (location.id) self.addLocation(location, levelid);
			});
		}

		self.addLocation = function(location, levelid) {
			// jump if location ID exists
			if (self.l[location.id]) return true;

			// building the location object
			self.l[location.id] = location;

			// groups
			var groups = location.category;
			if (groups) {
				if (typeof groups == 'string') groups = groups.toString().split(',');
				groups.forEach(function(group) { if (self.g[group]) self.g[group].nr++; });
			}

			// cascaded fill
			var fill = (location && location.fill) ||
				(location.category && self.g[location.category] && self.g[location.category].color) ||
				(location.category && location.category[0] && self.g[location.category[0]] && self.g[location.category[0]].color) ||
				self.o.fillcolor || false;

			// cascade style to attribute styleD!
			location.styled = (location && location.style) ||
				(location.category && self.g[location.category] && self.g[location.category].style) ||
				(location.category && location.category[0] && self.g[location.category[0]] && self.g[location.category[0]].style) ||
				self.o.defaultstyle || false;
			
			if (fill) location.color = fill;
			else if (location.styled) location.color = location.styled.base;

			// interactive element
			var elem = $('[id^=MLOC] > *[id="' + location.id + '"], [id^=landmark] > *[id="' + location.id + '"]', self.map);
			if (elem.length > 0) {
				location.el = elem;
				location.el.addClass('mapplic-clickable');

				if (location.styled) {
					location.el.addClass(location.styled);
				}
				else if (fill) {
					location.el.css('fill', fill);
					$('> *', location.el).css('fill', fill);
				}
			}

			// first level if not set
			if (!location.level) {
				if (levelid) location.level = levelid;
				else if (location.el && location.el.closest('.mapplic-layer').data('floor')) location.level = location.el.closest('.mapplic-layer').data('floor');
				else location.level = self.data.levels[0].id;
			}

			// description vars
			if (location.description) location.description = replaceVars(location.description, location);

			// geolocation
			if (location.lat && location.lng) {
				var pos = latlngToPos(location.lat, location.lng);
				location.x = pos.x;
				location.y = pos.y;
			}

			// estimated position
			if ((!location.x || !location.y) && elem) {
				var pos = estimatedPosition(location.el);
				location.x = pos.x;
				location.y = pos.y;
			}

			// marker
			if (!location.pin) location.pin = self.o.marker;
			location.marker = self.addMarker(location);

			// reveal mode
			if (location.action == 'reveal') $('.mapplic-pin[data-location^=' + location.id + ']', self.map).css('visibility', 'hidden');

			if (self.sidebar) self.sidebar.countCategory();
		}

		self.addMarker = function(location) {
			// hidden marker
			if (location.pin.indexOf('hidden') != -1) return false;

			var parent = $('.mapplic-layer[data-floor=' + location.level + '] .mapplic-map-image', self.el);
			var marker = $('<a></a>').addClass('mapplic-pin').addClass(location.pin.replace('hidden', '')).attr('aria-label', location.title + ' marker').css({'top': (location.y * 100) + '%', 'left': (location.x * 100) + '%'}).appendTo(parent);
			marker.on('click touchend', function(e) {
				if (e.cancelable) e.preventDefault();

				var shift = Math.abs(self.firstcoord.x - self.lastcoord.x) + Math.abs(self.firstcoord.y - self.lastcoord.y);
				if (!self.dragging || shift < 4) self.showLocation(location.id, 600);
			});

			if (location.label) {
				if (location.label.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g)) marker.css('background-image', 'url(' + location.label + ')');
				else $('<span><span>' + location.label + '</span></span>').appendTo(marker);
			}
			if (location.reveal) marker.attr('data-reveal', location.reveal).css('visibility', 'hidden');
			if (location.category) {
				location.category = location.category.toString();
				marker.attr('data-category', location.category);
			}
			marker.attr('data-location', location.id);

			if (self.o.zoom && self.o.mousewheel) marker.on('mousewheel DOMMouseScroll', self.mouseWheel);
			if (location.styled) marker.addClass(location.styled);
			if (location.color && location.pin.indexOf('pin-text') > -1) marker.css('color', location.color);
			else if (location.color) marker.css({'background-color': location.color, 'border-color': location.color });
			
			location.el = marker;
			return marker;
		}

		// removing locations
		self.removeLocations = function() {
			$.each(self.l, function(i, location) {
				self.removeLocation(location.id);
			});
		}

		self.removeLocation = function(location) {
			if (location.id) location = location.id;
			delete self.l[location];
			$('.mapplic-pin[data-location="' + location + '"]', self.map).remove();
			$('.mapplic-tooltip[data-location="' + location + '"]', self.el).remove();
			$('.mapplic-list-location[data-location="' + location + '"]', self.el).remove();
			$('svg #' + location, self.map).removeClass();
		}

		self.getLocationData = function(id) {
			return self.l[id];
		}

		self.showLocation = function(id, duration, check) {
			var location = self.location = self.l[id];
			if (!location) return false;

			// trigger event
			self.el.trigger('locationopen', location);

			var action = (location.action && location.action != 'default') ? location.action : self.o.action;
			if (action == 'disabled') return false;

			var content = null;
			self.closeTooltips();

			switch (action) {
				case 'open-link':
					window.location.href = location.link;
					return false;
				case 'open-link-new-tab':
					window.open(location.link);
					self.location = null;
					return false;
				case 'select':
					if (location.el) {
						if (location.el.hasClass('mapplic-active')) {
							location.el.removeClass('mapplic-active');
							if (location.list) location.list.removeClass('mapplic-active');
						}
						else {
							location.el.addClass('mapplic-active');
							if (location.list) location.list.addClass('mapplic-active');
						}
					}
					return false;
				case 'none':
					self.hideLocation();
					self.switchLevel(location.level);
					if (!self.bboxZoom(location.el)) self.zoomLocation(location);
					break;
				case 'reveal':
					self.hideLocation();
					self.switchLevel(location.level);
					self.container.revealChild(location);
					if (self.o.zoom) self.bboxZoom(location.el); 
					break;
				case 'external':
					self.hideLocation();
					self.switchLevel(location.level);
					if (!self.bboxZoom(location.el)) self.zoomLocation(location);
					if (self.external) self.external.show(location);
					break;
				case 'lightbox':
					self.hideLocation();
					self.switchLevel(location.level);
					content = self.lightbox.show(location);
					break;
				case 'image':
					self.hideLocation();
					self.switchLevel(location.level);
					self.lightbox.showImage(location);
					break;
				case 'route':
					check = true;
					break;
				default:
					self.hideLocation();
					self.switchLevel(location.level);
					setTimeout(function() { content = self.addTooltip(location, check); }, 2);
			}

			self.location = self.l[id];

			// active state
			$('.mapplic-active', self.scope).removeClass('mapplic-active');
			if (location.el) location.el.addClass('mapplic-active');
			if (location.list) location.list.addClass('mapplic-active');

			// deeplinking
			if ((self.deeplinking) && (!check)) self.deeplinking.update(id);

			// trigger event
			self.el.trigger('locationopened', [location, content]);
		}

		self.zoomLocation = function(loc) {
			var zoom = loc.zoom ? parseFloat(loc.zoom)/self.o.maxscale : 1;
			if (self.o.zoom) self.moveTo(loc.x, loc.y, zoom, 600);
		}

		self.hideLocation = function() {
			$('.mapplic-active', self.scope).removeClass('mapplic-active');
			if (self.deeplinking && self.deeplinking.resolved) self.deeplinking.clear();
			if (self.external) self.external.hide();
			self.closeTooltips();
			self.location = null;

			// trigger event
			self.el.trigger('locationclosed');
		}

		self.updateLocation = function(id) {
			// remove + add
			var location = self.l[id];

			if ((location.id == id) && (location.el.is('a')))  {
				// Geolocation
				if (location.lat && location.lng) {
					var pos = latlngToPos(location.lat, location.lng);
					location.x = pos.x;
					location.y = pos.y;
				}
				
				var top = location.y * 100,
					left = location.x * 100;
				location.el.css({'top': top + '%', 'left': left + '%'});
			}
		}

	};

	// jQuery plugin
	$.fn.mapplic = function(options) {

		return this.each(function() {
			var element = $(this);

			// plugin already initiated on element
			if (element.data('mapplic')) return;

			var instance = (new Mapplic(element)).init(options);

			// store plugin object in element's data
			element.data('mapplic', instance);
		});
	};

})(jQuery);

// call plugin on map instances
jQuery(document).ready(function($) {
	$('[id^=mapplic-id]').mapplic();

	// dynamic element
	var observer = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			var newNodes = mutation.addedNodes;
			if (newNodes !== null) {
				$(newNodes).each(function() {
					var node = $(this);
					if (node.is('[id^=mapplic-id]')) node.mapplic();
				});
			}
		});
	});

	observer.observe(document, {attributes: false, childList: true, characterData: false, subtree: true});
});