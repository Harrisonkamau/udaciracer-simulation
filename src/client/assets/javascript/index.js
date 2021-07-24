// The store will hold all information needed globally
var store = {
	track_id: undefined,
	player_id: undefined,
	race_id: undefined,
	tracks: [],
}

// We need our javascript to wait until the DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
	onPageLoad()
	setupClickHandlers()
})

async function onPageLoad() {
	try {
		getTracks()
			.then(tracks => {
				const html = renderTrackCards(tracks)
				renderAt('#tracks', html)
			})

		getRacers()
			.then((racers) => {
				const html = renderRacerCars(racers)
				renderAt('#racers', html)
			})
	} catch(error) {
		console.log("Problem getting tracks and racers ::", error.message)
		console.error(error)
	}
}

function setupClickHandlers() {
	document.addEventListener('click', function(event) {
		const { target } = event

		// Race track form field
		if (target.matches('.card.track')) {
			handleSelectTrack(target)
		}

		// Podracer form field
		if (target.matches('.card.podracer')) {
			handleSelectPodRacer(target)
		}

		// Submit create race form
		if (target.matches('#submit-create-race')) {
			event.preventDefault()

			// start race
			handleCreateRace()
		}

		// Handle acceleration click
		if (target.matches('#gas-peddle')) {
			handleAccelerate(target)
		}

	}, false)
}

async function delay(ms) {
	try {
		return await new Promise(resolve => setTimeout(resolve, ms));
	} catch(error) {
		console.log("an error shouldn't be possible here")
		console.log(error)
	}
}

// This async function controls the flow of the race, add the logic and error handling
async function handleCreateRace() {
	try {
		const selectedTrack = getTrackById(store.track_id);
		renderAt('#race', renderRaceStartView(selectedTrack));

		const defaultPlayerId = store.player_id !== undefined ? store.player_id : 1;
		const race = await createRace({ player_id: defaultPlayerId, track_id: store.track_id });

		Object.assign(store, { race_id: parseInt(race.ID) - 1, player_id: race.PlayerID });

		await runCountdown();

		await startRace(race.ID);

		await runRace(race.ID);

	} catch (error) {
		console.error('Could create a race', error.message);
	}
}

function runRace(raceID) {
	return new Promise(resolve => {
	const intervalID = setInterval(async () => {
		const parsedId = parseInt(raceID) - 1;
		const race = await getRaceById(parsedId);

		if (race) {
			if (race.status === 'in-progress') {
				renderAt('#leaderBoard', raceProgress(race.positions));
			}

			if (race.status === 'finished') {
				console.log('race is finished');
				clearInterval(intervalID);
				renderAt('#race', resultsView(race.positions));
				resolve(race);
			}
		}
	}, 500);
	}).catch((error) => console.error(`[runRace] Error: ${error.message}`));
}

async function runCountdown() {
	try {
		// wait for the DOM to load
		await delay(1000);
		let timer = 3;

		return new Promise(resolve => {
			const intervalId = setInterval(() => {
				document.getElementById('big-numbers').innerHTML = --timer;

				if (timer === 0) {
					clearInterval(intervalId);
					resolve();

					return;
				}
			}, 1000);
		});
	} catch(error) {
		console.log('[runCountdown] Error --->', error);
	}
}

function handleSelectPodRacer(target) {
	console.log("selected a pod", target.id)

	// remove class selected from all racer options
	const selected = document.querySelector('#racers .selected')
	if (selected) {
		selected.classList.remove('selected');
	}

	// add class selected to current target
	target.classList.add('selected');

	Object.assign(store, { race_id: target.id });
}

function handleSelectTrack(target) {
	console.log("selected a track", target.id)

	// remove class selected from all track options
	const selected = document.querySelector('#tracks .selected')
	if(selected) {
		selected.classList.remove('selected')
	}

	// add class selected to current target
	target.classList.add('selected');

	Object.assign(store, { track_id: target.id });
}

function handleAccelerate() {
	console.log("accelerate button clicked");
	accelerate(store.race_id)
		.then((res) => console.log('[handleAccelerate] triggered'))
		.catch((error) => console.error('[handleAccelerate] Error: ', error));
}

// HTML VIEWS ------------------------------------------------

function renderRacerCars(racers) {
	if (!racers.length) {
		return `
			<h4>Loading Racers...</4>
		`
	}

	const results = racers.map(renderRacerCard).join('')

	return `
		<ul id="racers">
			${results}
		</ul>
	`
}

function renderRacerCard(racer) {
	const { id, driver_name, top_speed, acceleration, handling } = racer

	return `
		<li class="card podracer" id="${id}">
			<h3>${driver_name}</h3>
			<p>${top_speed}</p>
			<p>${acceleration}</p>
			<p>${handling}</p>
		</li>
	`
}

function renderTrackCards(tracks) {
	if (!tracks.length) {
		return `
			<h4>Loading Tracks...</4>
		`
	}

	const results = tracks.map(renderTrackCard).join('')

	return `
		<ul id="tracks">
			${results}
		</ul>
	`
}

function renderTrackCard(track) {
	const { id, name } = track

	return `
		<li id="${id}" class="card track">
			<h3>${name}</h3>
		</li>
	`
}

function renderCountdown(count) {
	return `
		<h2>Race Starts In...</h2>
		<p id="big-numbers">${count}</p>
	`
}

function renderRaceStartView(track, racers) {
	return `
		<header>
			<h1>Race: ${track.name}</h1>
		</header>
		<main id="two-columns">
			<section id="leaderBoard">
				${renderCountdown(3)}
			</section>

			<section id="accelerate">
				<h2>Directions</h2>
				<p>Click the button as fast as you can to make your racer go faster!</p>
				<button id="gas-peddle">Click Me To Win!</button>
			</section>
		</main>
		<footer></footer>
	`
}

function resultsView(positions) {
	positions.sort((a, b) => (a.final_position > b.final_position) ? 1 : -1)

	return `
		<header>
			<h1>Race Results</h1>
		</header>
		<main>
			${raceProgress(positions)}
			<a href="/race">Start a new race</a>
		</main>
	`
}

function raceProgress(positions) {
	let userPlayer = positions.find(e => e.id === store.player_id)
	userPlayer.driver_name += " (you)"

	positions = positions.sort((a, b) => (a.segment > b.segment) ? -1 : 1)
	let count = 1

	const results = positions.map(p => {
		return `
			<tr>
				<td>
					<h3>${count++} - ${p.driver_name}</h3>
				</td>
			</tr>
		`
	})

	return `
		<main>
			<h3>Leaderboard</h3>
			<section id="leaderBoard">
				${results}
			</section>
		</main>
	`
}

function renderAt(element, html) {
	const node = document.querySelector(element)

	node.innerHTML = html
}


// API CALLS ------------------------------------------------

const SERVER = 'http://localhost:8000';

function defaultFetchOpts() {
	return {
		mode: 'cors',
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin' : SERVER,
		},
	};
}

async function getTracks() {
	try {
		const response = await fetch(`${SERVER}/api/tracks`);
		const tracks = await response.json();
		Object.assign(store, { tracks });
		return tracks;
	} catch (error) {
		console.error(`Error while retrieving tracks: ${error.message}`);
	}
}

async function getRacers() {
	try {
		const response = await fetch(`${SERVER}/api/cars`);
		const racers = await response.json();
		return racers;
	} catch (error) {
		console.error(`Error while retrieving racers: ${error.message}`);
	}
}

function createRace({ track_id, player_id = 1 }) {
	player_id = parseInt(player_id);
	track_id = parseInt(track_id);
	const body = { player_id, track_id };

	return fetch(`${SERVER}/api/races`, {
		method: 'POST',
		...defaultFetchOpts(),
		dataType: 'jsonp',
		body: JSON.stringify(body),
	})
	.then(res => res.json())
	.catch(err => console.log('Problem with createRace request::', err));
}

function getTrackById(id) {
	try {
		const track = store.tracks.find((track) => Number(track.id) === Number(id));

		if (!track) {
			throw Error(`Track with ID: ${id} cannot be found`);
		}

		return track;
	} catch (error) {
		console.error('An error occurred while fetching a track by id: ', error.message);
	}
}

async function getRaceById(id) {
	try {
		const parsedId = parseInt(id, 10);
		const response = await fetch(`${SERVER}/api/races/${parsedId}`);
		const data = await response.json();
		return data;
	} catch (error) {
		console.log(`Could not retrieve the race by id: ${error.message}`)
	}
}


function startRace(id) {
	const parsedId = parseInt(id) - 1;

	return fetch(`${SERVER}/api/races/${parsedId}/start`, {
		method: 'POST',
		...defaultFetchOpts(),
	})
	.then(res => console.log('race has started', res.clone()))
	.catch(err => console.error(`Could not start race: ${err.message}`));
}

async function accelerate(id) {
	try {
		const parsedId = parseInt(id, 10);
		const response = await fetch(`${SERVER}/api/races/${parsedId}/accelerate`, {
			method: 'POST',
			...defaultFetchOpts(),
		});

		console.log('Acceleration begun', response.clone());
	} catch (error) {
		console.error(`[accelerate] Error while accelerating: ${error.message}`);
	}
}
