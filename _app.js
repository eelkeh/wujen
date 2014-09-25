/**
 * Cineville Wujen
 * Grid based wizard
 * |\
 * | \
 * |  \
 * |   \
 * ()o-o()
 *   ###
 *    #
 *
 * WEEK
 *     TITLE
 *         ROW
 *             POSITION
 */
(function () {
    "use strict";

    var SHOWTIME_FORMAT = "YYYY-MM-DDTHH:mm:ssZZ",
        SHOWTIME_DAY_FORMAT = "YYYY-MM-DD",
        SHOWTIME_TIME_FORMAT = "HH:mm",
        ENTER_KEY = 13,
        ESCAPE_KEY = 27,
        ARROW_UP = 38,
        ARROW_DOWN = 40,
        IGNORE = true,
        BASE_URL = 'http://127.0.0.1:8000/api/1';


    moment.lang('nl');

    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    function lastThursday() {
        var diff = (moment().day() + 3) % 7;
        return (diff) ? moment().subtract('days', diff) : moment();
    }

    /**
     * Show model
     * @param {obj} data initial values
     */
    function Show(data) {
        this.title = ko.observable(data.title);
        this.location = ko.observable(data.location_id);
        this.showtime = ko.observable(data.start);
        // internal date state
        if (this.showtime) {
            this._date = moment(this.showtime(), SHOWTIME_FORMAT);
        }

        // Computed values
        this.time = ko.computed(function() {
            return this.showtime() ?
                moment(this.showtime(), SHOWTIME_FORMAT).format(SHOWTIME_TIME_FORMAT) : '';
        }, this);

        this.zomby = ko.computed(function() {
            return !this.showtime();
        }, this);

        this.inputError = ko.observable(false);

        ko.computed(function(showtime) {
            console.log(this.zomby());
            this.showtime();
            this.title();
            console.log('model change!');
        }, this);

        // We need some kind of way to set the internal date object while triggering
        // some model change on some scalar, which triggers the computed date representations
        this.setDate = function(newDate, ignore) {
            this._date = newDate;
            if (!ignore) this.showtime(this._date.format(SHOWTIME_FORMAT));
        }.bind(this);

        this.getDayNr = function() {
            // day nr (sunday = 0) to film week nr (thursday = 0)
            return (parseInt(this._date.format('d')) + 3) % 7;
        };
    }

    var rowFactory = function(shows, start) {
        // @TODO return an array(7) with shows and 'zomby' shows
        // maybe like:
        // {title: filmpje, rows: [
        //      [show, show, show, show, show ...]
        //      [show, show, show(null), show, show ...]
        //      [show, show(null), show, show, show ...]
        // ]}

        // Shows already constructed?
        if (shows[0].constructor.name !== 'Show') {
            shows = _.map(shows, function(obj) { return new Show(obj); });
        }

        var titles = _.unique(_.pluck(shows, 'title'));

        var firstDate = _.chain(shows)
            .sortBy(function(show) {
                return - show._date.format('X');
            })
            .map(function(show) {
                show._day = parseInt(show._date.format('d'));
                return show;
            })
            .findWhere({_day: 4})
            .value()._date.clone();

        //consle.log(firstDate._date);

        var row = function(title) {
            return _.map(_.range(7), function(i) {
                var show = new Show({title: title, start: null, location: 1 });
                show.setDate(firstDate.clone().add('days', i), IGNORE);
                return show;
            });
        };

        //console.log(_.map(row('piet'), function(show) { return show._date.format('d'); }));

       var rows = _.map(titles, function(title) {
            return {
                title: title,
                shows: _.chain(shows)
                    .filter(function(obj) { return obj.title() === title; })
                    .reduce(function(memo, show) {
                        // start of the week is not monday but thursday!
                        var dayNr = (parseInt(show._date.format('d')) + 3) % 7;
                        var i = 0;
                        while (memo[i][dayNr].showtime() !== null) {
                            i++;
                            if (i === memo.length) {
                                memo.push(row(title));
                                break;
                            }
                        }
                        memo[i][dayNr] = show;
                        return memo;
                    }, new Array(row(title))).value()
            };
        });
       console.log(rows);
       return rows;
    };


    /**
     * Grid 'view'
     * @param {array} shows init objects
     *
     * @TODO Week selection <--> ?
     * @TODO implement undo?
     */
    var Grid = function() {
        var self = this;
        var location = 6; // @TODO how to determine location?
        this.location = location;

        this.currentWeek = ko.observable();
        this.slots = ko.observableArray();

        // Determine current week to fill the grid
        // @TODO some routing to determine the week?
        // For now it's always the current week we're in
        var thursday = lastThursday();
        this.currentWeek({
            start: thursday,
            end: thursday.clone().add(7, "days")
        });

        // Populats this.slots with shows in the current week
        this.getShows = function(start, end) {
            var q = '&start__gte=' + start.format('YYYY-MM-DD') + '&start__lt=' + end.format('YYYY-MM-DD')  + '&location__id=' + location;
            $.getJSON(BASE_URL + '/shows/?format=json&username=eelke&api_key=asdf&limit=500' + q)
               .success(
                    function(data) {
                        var objs = _.map(data.objects, function(obj) {
                            return {
                                start: obj.start,
                                location_id: obj.location.id,
                                title: obj.film_version.title
                            };
                        });
                        self.slots(rowFactory(objs));
                    }
                )
                .error(function() {
                    self.slots([]);
                });
        };

        // Get all shows in current week!
        this.getShows(this.currentWeek().start, this.currentWeek().end);

        this.prettyStartDate = ko.computed(function() {
            return self.currentWeek().start.format('dddd D MMMM');
        });

        this.prettyEndDate = ko.computed(function() {
            return self.currentWeek().end.format('dddd D MMMM');
        });

        /**
         * adds new row
         * create single zomby show, and set the date to the start of
         * the current week, the row factory will populate the rest of the row
         * correctly from the internal _date property set by setDate.
         */
        this.addRow = function() {
            var newShow = new Show({location_id: 6});
            newShow.setDate(this.currentWeek().start, IGNORE);
            this.slots.push(rowFactory([newShow])[0]);
        };

        /**
         * @TODO remove entire row at once?
         */
        this.removeRow = function(title, index) {
            var _slots = self.slots();
            _.each(_slots, function(slot) {
                if (slot.title() === title) {
                    slot.shows.splice(index, 1);
                }
            });
            self.slots.removeAll();
            _.each(_slots, function(slot) {
                self.slots.push(slot);
            });
            // the change in the observable is nested so we should
            // notify the observable of the changes manually
            //self.slots.valueHasMutated();
        };

        /**
         * (re)sets the title for all shows in the row
         */
        this.setRowTitle = function(row, e) {
            var title = e.srcElement.value;
            _.each(row, function(show) {
                show.title(title);
            });
        };

        /**
         * Zombify show
         * @note doesn't actually remove the model instance
         */
        this.remove = function (item) {
            item.showtime(null); // set zomby state
        };


        /**
         * on focus of input select all text
         */
        this.onFocus = function(item, e) {
            e.target.select();
        };

        /**
         * repeat focussed showtime for null items in the current row
         */
        this.repeat = function(list, item) {
            if (item.showtime() === null) return;
            _.each(list, function(show, i) {
                console.log(show);
                if (show.showtime() === null && i > item.getDayNr()) {
                    console.log(i, show._day);
                    show.setDate(item._date);
                }
            });
        };

        this.saveEditing = function (item) {
            console.log('enter save');
            item.editing(false);
        }.bind(this);

        // Triggered events
        this.timeAdd = function(item, e) {
            e.preventDefault(); // ARROW_UP moves carret to the start of the input
            item.setDate(item._date.add('minutes', 15));
        };

        this.timeSubtract = function(item, e) {
            item.setDate(item._date.subtract('minutes', 15));
        };

        this.timeAutoComplete = function(item, e) {
            item.inputError(false);
            var hhmm = e.target.value;
            switch (hhmm.length) {
                case 0:
                    return item.showtime(null);
                case 1:
                    hhmm += "0:00";
                    break;
                case 2:
                    hhmm += ":00";
                    break;
                case 3:
                    hhmm += "0";
                    break;
                case 4:
                    if (isNumber(hhmm)) {
                        hhmm = hhmm.substring(0, 2) +
                        ':' + hhmm.substring(2, 4);
                    }
                    break;
                case 5: break;
                default: // > 5
                    hhmm = hhmm.substring(0, 4);
                    break;
            }
            if (!isNumber(hhmm.substring(0, 2)) ||
                !isNumber(hhmm.substring(3, 5)) ||
                parseInt(hhmm.substring(0, 2)) > 23
                ) {
                    item.inputError(true);
                    console.log('invalid date');
                    return;
            }
            item.setDate(moment(
                item._date.format(SHOWTIME_DAY_FORMAT) + 'T' + hhmm + ':00+0200',
                SHOWTIME_FORMAT
            ));
        };

        // Triggered whenever some model prop changes?
        ko.computed(function () {
            console.log(JSON.parse(ko.toJSON(this.slots)));
            localStorage.setItem('shows', ko.toJSON(this.slots));
        }.bind(this)).extend({
            rateLimit: { timeout: 500, method: 'notifyWhenChangesStop' }
        });
    };

    // A factory function we can use to create binding handlers for specific
    // keycodes.
    function keyhandlerBindingFactory(keyCode) {
        return {
            init: function (element, valueAccessor, allBindingsAccessor, data, bindingContext) {
                var wrappedHandler, newValueAccessor;

                // wrap the handler with a check for the enter key
                wrappedHandler = function (data, event) {
                    if (event.keyCode === keyCode) {
                        valueAccessor().call(this, data, event);
                    }
                };

                // create a valueAccessor with the options that we would want to pass to the event binding
                newValueAccessor = function () {
                    return {
                        keyup: wrappedHandler
                    };
                };

                // call the real event binding's init function
                ko.bindingHandlers.event.init(element, newValueAccessor, allBindingsAccessor, data, bindingContext);
            }
        };
    }

    ko.bindingHandlers.enterKey = keyhandlerBindingFactory(ENTER_KEY);
    // ko.bindingHandlers.escapeKey = keyhandlerBindingFactory(ESCAPE_KEY);
    // Time controls
    ko.bindingHandlers.arrowUp = keyhandlerBindingFactory(ARROW_UP);
    ko.bindingHandlers.arrowDown = keyhandlerBindingFactory(ARROW_DOWN);

    // wrapper to hasFocus that also selects text and applies focus async
    ko.bindingHandlers.selectAndFocus = {
        init: function (element, valueAccessor, allBindingsAccessor, bindingContext) {
            ko.bindingHandlers.hasFocus.init(element, valueAccessor, allBindingsAccessor, bindingContext);
            ko.utils.registerEventHandler(element, 'focus', function () {
                element.focus();
            });
        },
        update: function (element, valueAccessor) {
            ko.utils.unwrapObservable(valueAccessor()); // for dependency
            // ensure that element is visible before trying to focus
            setTimeout(function () {
                ko.bindingHandlers.hasFocus.update(element, valueAccessor);
            }, 0);
        }
    };


    var dummies = [
        {title: 'Superbad', location: 1, showtime: '2014-08-07T18:00', row: 0},
        {title: 'Superbad', location: 1, showtime: '2014-08-08T18:15'},
        {title: 'Superbad', location: 1, showtime: '2014-08-09T18:00'},
        {title: 'Superbad', location: 1, showtime: '2014-08-10T18:00'},
        {title: 'Superbad', location: 1, showtime: '2014-08-11T18:00'},
        {title: 'Superbad', location: 1, showtime: '2014-08-12T18:00'},
        {title: 'Superbad', location: 1, showtime: '2014-08-13T18:00'},
        {title: 'Superbad', location: 1, showtime: '2014-08-11T20:00'},
        {title: 'Superbad', location: 1, showtime: '2014-08-12T20:00'},
        {title: 'Superbad', location: 1, showtime: '2014-08-13T12:00'},
        {title: 'Superbad', location: 1, showtime: '2014-08-07T14:00'},

        {title: 'Iron Man', location: 1, showtime: '2014-08-07T14:00'},
        {title: 'Iron Man', location: 1, showtime: '2014-08-08T12:15'},

        {title: 'Locke', location: 1, showtime: '2014-08-11T12:15'},

        //{title: 'Superbad', location: 1, showtime: '2014-04-24T14:00+00:00'},
    ];

    // var q = '&start__gte=2014-08-07&start__lt=2014-08-14&location__id=6';

    ko.applyBindings(new Grid());

}());