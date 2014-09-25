(function(){
    var notify = function() {
        console.log('something changed!')
    }

    var Show = function(data) {
        if (_.isUndefined(data.dummy)) {
            data.dummy = false;
        }
        for (var key in data) {
            this[key] = ko.observable(data[key]);
            this[key].subscribe(notify);
        }
    }


    var setShowTimes = function(show) {
        var mom =  moment(show['showtime']);
        show['daynr'] = parseInt(mom.format('d'));
        show['time'] = mom.format('HH:mm');
        return show;
    }

    var AppViewModel = function(rawShows) {
        var groupedShows = _.chain(rawShows)
            .map(function(show) {
                return setShowTimes(show);
            })
            .groupBy(function(show) {
                return show.title;
            })
            .value();

        var slots = [];
        var newSlot = function() {
            var slot = [];
            for (i = 0; i < 7; i++) {
                var showData = {
                    showtime: '2014-04-24T00:00+00:00',
                    dummy: true,
                    title: null,
                }
                showData = setShowTimes(showData);
                slot.push(new Show(showData));
            }
            return slot;
        }
        slots.push(newSlot());

        for (film in groupedShows) {
            var shows = _.sortBy(groupedShows[film],
                function(show) { return show.time });
            shows.reverse();

            while (shows.length) {
                var show = shows.pop();
                var found = false;
                slots.forEach(function(slot) {
                    if (slot[show.daynr].dummy() === true) {
                        slot[show.daynr] = new Show(show);
                        found = true;
                    }
                });
                if (found === false) {
                    slots.push(newSlot());
                    console.log(slots);
                    var nSlot = slots[slots.length - 1];
                    nSlot[show.daynr] = new Show(show);
                }
            }
        }
        this.slots = slots.map(function(daysArr) {
            var title = _.chain(daysArr)
                .invoke('title')
                .filter(function(title) { return title !== null })
                .value()[0];

            return {
                days: daysArr,
                title: title
            };
        });

        console.log(this.slots);
        return {
            superslots: ko.observableArray(this.slots)
        }
    }

    window.onload = function() {
        var shows = [
            {title: 'Superbad', location: 1, showtime: '2014-04-24T18:00+00:00'},
            {title: 'Superbad', location: 1, showtime: '2014-04-25T18:15+00:00'},
            {title: 'Superbad', location: 1, showtime: '2014-04-26T18:00+00:00'},
            {title: 'Superbad', location: 1, showtime: '2014-04-27T18:00+00:00'},
            {title: 'Superbad', location: 1, showtime: '2014-04-28T18:00+00:00'},
            {title: 'Superbad', location: 1, showtime: '2014-04-29T18:00+00:00'},
            {title: 'Superbad', location: 1, showtime: '2014-04-30T18:00+00:00'},

            {title: 'Superbad', location: 1, showtime: '2014-04-24T20:00+00:00'},
            {title: 'Superbad', location: 1, showtime: '2014-04-25T20:00+00:00'},
            {title: 'Superbad', location: 1, showtime: '2014-04-26T12:00+00:00'},
            {title: 'Superbad', location: 1, showtime: '2014-04-26T12:00+00:00'},

            //{title: 'Superbad', location: 1, showtime: '2014-04-24T14:00+00:00'},
        ];

        var shizzle = new AppViewModel(shows);
        ko.applyBindings(shizzle);
    }
})();