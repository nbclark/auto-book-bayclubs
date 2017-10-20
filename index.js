const fs = require('fs');
const fetch = require('fetch-cookie')(require('node-fetch'));
const cheerio = require('cheerio');
const URLSearchParams = require('url').URLSearchParams;
const Sequential = require('promise-sequential');

const defaultConfig = {
  username: 'foo@bar.com',
  password: '<FILL THIS IN>',
  myId: '<FILL IN WITH ID FROM BOOKING SITE>',
  defaultPartnerId: '255229',
  patterns: [
    {
      partnerId: '<FILL IN WITH PARTNER ID FROM BOOKING SITE - USE 255229 for practice serve>',
      dayOfWeek: 'Monday', // Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday,
      timeRanges: [
        ['7:00 PM', '7:30 PM', '8:00 PM'],
        ['7:30 PM', '8:00 PM', '8:30 PM'],
        ['6:30 PM', '7:00 PM', '7:30 PM'],
        ['7:00 PM', '7:30 PM'],
        ['7:30 PM', '8:00 PM'],
        ['6:30 PM', '7:00 PM'],
        ['9:00 PM', '9:30 PM'],
      ],
    }
  ],
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
if (!fs.existsSync('./config.json')) {
  console.error('Missing config.json. Creating now...');
  console.error('Please edit and rerun.');
  console.log();
  fs.writeFileSync('./config.json', JSON.stringify(defaultConfig, 2, 2), { encoding: 'utf8' });
  process.exit(-1);
}

console.log();
console.log('\t Starting...');
const config = JSON.parse(fs.readFileSync('./config.json', { encoding: 'utf8' }));

function main() {
  const form = new URLSearchParams();
  form.append('username', config.username);
  form.append('password', config.password);
  // POST - https://courtbooking.bayclubs.com/authenticate.lasso
  fetch('https://courtbooking.bayclubs.com/authenticate.lasso?np=8756228e-1bea-48b7-ac5c-8b93cd87a461', {
    method: 'POST',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Host: 'courtbooking.bayclubs.com',
      Origin: 'https://courtbooking.bayclubs.com',
    },
    body: form.toString(),
  }).then(res => res.text())
    .then(res => {
      console.log('\t Logged in...');
      return fetch('https://courtbooking.bayclubs.com/index.lasso', {})
        .then(res => res.text())
        .then(res => {
          console.log('\t Got index...');
          const data = cheerio.load(res);
          const options = data('#tennislocation option'); // Bay Club SF Tennis Indoor
          const indoorOptionValue = 1;
          const formDates = new URLSearchParams();
          formDates.append('range_id', 1);
          formDates.append('memberid', 1000);
          return fetch('https://courtbooking.bayclubs.com/get_court_dates.lasso?np=9756228e-1bea-48b7-ac5c-8b93cd87a461', {
            method: 'POST',
            headers: {
              'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
              Host: 'courtbooking.bayclubs.com',
              Origin: 'https://courtbooking.bayclubs.com',
            },
            body: formDates.toString(),
          })
            .then(res => res.text())
            .then(res => {
              console.log('\t Got availability...');
              const data = cheerio.load(res);
              const firstDaySearchString = "jQuery('#tennisfirstday').val('";
              const firstDayIndex = res.indexOf(firstDaySearchString) + firstDaySearchString.length;
              const firstDayValue = res.substring(firstDayIndex, firstDayIndex + 10);
              const lastDaySearchString = "jQuery('#tennislastday').val('";
              const lastDayIndex = res.indexOf(lastDaySearchString) + lastDaySearchString.length;
              const lastDayValue = res.substring(lastDayIndex, lastDayIndex + 10);

              // TODO - add support for iterating over available days
              const firstDay = new Date(firstDayValue + ' 12:00 PM');
              const lastDay = new Date(lastDayValue + ' 12:00 PM');
              const daysToCheck = [];
              for (let day = lastDay; day > firstDay; day.setDate(day.getDate() - 1)) {
                //console.log(day.toISOString().substring(0, 10));
                daysToCheck.push(day.toISOString().substring(0, 10));
              }

              Sequential(daysToCheck.map(date => () => attemptBookingForDate(date, indoorOptionValue)))
                .then(x => {
                  console.error();
                  console.error('\t Unable to book a court...');
                  console.error();
                  process.exit(-4);
                });
            });
        });
    })
    .catch(err => console.error(err));

  // {
  //   "ball_machine": 0,
  //   "booking_time": "2017-10-19 21:05:36",
  //   "court_blocks": "[\"a_010_21_00_2017-10-23_0\", \"a_010_21_30_2017-10-23_1\"]",
  //   "court_date": "2017-10-23",
  //   "court_id": 846787,
  //   "court_length": 1,
  //   "court_name": "Tennis 10",
  //   "court_number": 10,
  //   "court_range_id": 1,
  //   "court_sport": "Tennis",
  //   "court_status": 0,
  //   "court_surface": "SFT Indoor",
  //   "court_uid": "dd1de5e6-dd46-436b-8b0e-5a9ea2e3c220",
  //   "end_time": "22:00:00",
  //   "errormap": {
  //     "rule_0": "fail"
  //   },
  //   "mode": 30,
  //   "number_of_players": 2,
  //   "online_booking": 1,
  //   "player_1_first_name": "Nicholas",
  //   "player_1_id": 206143,
  //   "player_1_name": "Clark",
  //   "player_2_first_name": "Practice",
  //   "player_2_id": 255229,
  //   "player_2_name": "Serve",
  //   "player_3_first_name": "",
  //   "player_3_id": 0,
  //   "player_3_name": "",
  //   "player_4_first_name": "",
  //   "player_4_id": 0,
  //   "player_4_name": "",
  //   "reservation_type": "Open",
  //   "result": "OK",
  //   "start_time": "21:00:00",
  //   "successmap": {
  //     "rule_0": "success",
  //     "rule_1": "Allowed to view courts",
  //     "rule_10": "Sufficient players",
  //     "rule_13": "has not exceeded 1.5 hr. Currently have 0.000000 hr.1.000000",
  //     "rule_16": "No side by side",
  //     "rule_2": "Booking time reached",
  //     "rule_3": "Booking in future",
  //     "rule_5": "No back to back booking",
  //     "rule_6": "No back to back booking (2nd Player)",
  //     "rule_7": "Prime Time Booking",
  //     "rule_9": "Tennis 10 can be booked online"
  //   },
  //   "view_days": 15
  // }
}

function attemptBookingForDate(lastDayValue, indoorOptionValue) {
  console.log();
  console.log(`\t Attempting to book on ${lastDayValue}...`);
  return new Promise((resolve, reject) => {
    const dayOfWeek = new Date(lastDayValue + ' 12:00 PM').getDay();

    let partnerId = null;
    let foundMatchingDay = false;
    let matchingPattern = null;
    for (let i = 0; i < config.patterns.length; ++i) {
      const pattern = config.patterns[i];
      if (daysOfWeek.indexOf(pattern.dayOfWeek) === dayOfWeek) {
        console.log('\t Found pattern for search day of week...');
        foundMatchingDay = true;
        matchingPattern = pattern;
        partnerId = pattern.partnerId || config.defaultPartnerId;
        break;
      }
    }

    if (!foundMatchingDay) {
      console.error('\t Pattern not found for booking date. Moving on...');
      return resolve();
    }

    const formSearch = new URLSearchParams();
    formSearch.append('tennislocation', indoorOptionValue);
    formSearch.append('dayselection', '2');
    formSearch.append('court_date', lastDayValue);

    return fetch('https://courtbooking.bayclubs.com/page.lasso?np=4e45fbed-ae05-41da-af29-190a44190037', {
      method: 'POST',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Host: 'courtbooking.bayclubs.com',
        Origin: 'https://courtbooking.bayclubs.com',
      },
      body: formSearch.toString(),
    })
      .then(res => res.text())
      .then(res => {
        const $ = cheerio.load(res);
        const cells = $('.courtgrid td');
        const map = {};

        for (let i = 0; i < cells.length; ++i) {
          const cell = $(cells[i]);
          if (!cell.css('background-color')) {
            const courtTime = cell.find('p:first-child').text();
            const courtName = cell.find('p:last-child').text();

            if (!map[courtName]) {
              map[courtName] = {};
            }
            map[courtName][courtTime] = true;
          }
        }

        let foundCourt = null;
        let foundDates = null;
        try {
          console.log('\t Looking for availability...');
          matchingPattern.timeRanges.forEach(neededDates => {
            Object.keys(map).forEach(court => {
              const available = !neededDates.filter(date => !map[court][date]).length;
              if (available) {
                foundCourt = parseInt(court.split(' ')[1]);
                foundDates = neededDates;
                console.log('\t Found a time...');
                console.log('\t Start: ' + neededDates[0]);
                console.log('\t Court: #' + foundCourt);
                console.log('\t Duration: ' + neededDates.length * 30);
                throw new Error('Found one');
              }
            });
          });

          console.log('\t Sorry no matching times found...');
          return resolve();
        } catch (e) {
          // Hacky, but we have something to book

          const startDate = new Date(lastDayValue + ' ' + foundDates[0]);
          const myId = config.myId;
          //https://courtbooking.bayclubs.com/book_court.lasso
          const parameters = {
            "date": new Date().toISOString(),
            "mode": 30,
            "ball_machine": 0,
            "court_range_id": "1",
            "player_1_id": myId,
            "player_2_id": partnerId, // set up higher
            "court_number": foundCourt,
            "court_numberString": foundCourt.toString(),
            "first_numberString": "",
            "first_hourstring": "", "court_hour": startDate.getHours(),
            "court_hourstring": startDate.getHours(),
            "court_minute": "00", "court_date": lastDayValue,
            "start_time": `${startDate.getHours()}:${startDate.getMinutes()}:00`, //"21:00:00",
            "court_length": foundDates.length * 30,
            // Pretty sure none of this matters...
            "player_3_id": "", "player_4_id": "",
            "player_1_first_name": "Nicholas",
            "player_1_name": "Clark",
            "player_2_first_name": "Practice",
            "player_2_name": "Serve", "player_3_first_name": "", "player_3_name": "",
            "player_4_first_name": "", "player_4_name": "",
          };

          const formRequest = new URLSearchParams();
          formRequest.append('params', JSON.stringify(parameters));
          console.log('\t Booking court...');
          return fetch('https://courtbooking.bayclubs.com/book_court.lasso', {
            method: 'POST',
            headers: {
              'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
              Host: 'courtbooking.bayclubs.com',
              Origin: 'https://courtbooking.bayclubs.com',
            },
            body: formRequest.toString(),
          })
            .then(res => res.json())
            .then(res => {
              console.log('\t Court booked');
              console.log();
              process.exit(0);
              return resolve();
            });
        }
      });
  });
}

main();