/* ─── TRIP ITINERARY ─────────────────────────────────────────────────────────
   Fields:
   - id:    day key (d01…d20)
   - date:  display date
   - city:  location / route
   - day:   daytime activity description
   - night: evening activity description (empty string = no distinct evening)
   - occ:   primary occasion (used for local outfit generation)
   - w:     weather ("Cold" | "Mild" | "Warm")
   - e:     display emoji
   ─────────────────────────────────────────────────────────────────────────── */
const TRIP = [
  {id:"d01",date:"Wed Apr 1", city:"Delhi → Sydney",        day:"Overnight Flight",              night:"Flight",                         occ:"Flight",  w:"Cold", e:"✈️"},
  {id:"d02",date:"Thu Apr 2", city:"Sydney",                 day:"Arrival · Taronga Zoo · Ferry", night:"Phantom of the Opera — Evening Show (7:30 PM)", occ:"Casual",  w:"Mild", e:"🦁"},
  {id:"d03",date:"Fri Apr 3", city:"Sydney",                 day:"Bondi Beach",                   night:"🎂 Birthday Dinner",              occ:"Dinner",  w:"Warm", e:"🏖️"},
  {id:"d04",date:"Sat Apr 4", city:"Sydney",                 day:"Opera House · Harbour Bridge",  night:"Casual / Drinks",                 occ:"Casual",  w:"Warm", e:"🎭"},
  {id:"d05",date:"Sun Apr 5", city:"Sydney → Gold Coast",   day:"Flight · Arrival",              night:"Casual",                          occ:"Casual",  w:"Warm", e:"🌊"},
  {id:"d06",date:"Mon Apr 6", city:"Gold Coast",             day:"Sea World Theme Park",          night:"Casual",                          occ:"Casual",  w:"Warm", e:"🐬"},
  {id:"d07",date:"Tue Apr 7", city:"Gold Coast",             day:"Movie World Theme Park",        night:"Casual",                          occ:"Casual",  w:"Warm", e:"🎢"},
  {id:"d08",date:"Wed Apr 8", city:"Gold Coast → Melbourne", day:"Flight · Arrival",              night:"Rooftop Skyline Evening",          occ:"Dinner",  w:"Mild", e:"🌆"},
  {id:"d09",date:"Thu Apr 9", city:"Melbourne",              day:"Laneways + Cafés",              night:"Smart Casual Dinner",             occ:"Casual",  w:"Mild", e:"☕"},
  {id:"d10",date:"Fri Apr 10",city:"Melbourne",              day:"City Explore",                  night:"Casual / Drinks",                 occ:"Casual",  w:"Mild", e:"🏙️"},
  {id:"d11",date:"Sat Apr 11",city:"Melbourne → Queenstown", day:"Flight · Arrival · Town Walk",  night:"Lake Walk · Chill Dinner",        occ:"Dinner",  w:"Cold", e:"🏔️"},
  {id:"d12",date:"Sun Apr 12",city:"Queenstown",             day:"Milford Sound Fly & Cruise",    night:"Casual (Cold)",                   occ:"Hiking",  w:"Cold", e:"🚁"},
  {id:"d13",date:"Mon Apr 13",city:"Queenstown",             day:"Luge + Gondola",                night:"Cozy Dinner (Elevated)",          occ:"Casual",  w:"Cold", e:"🎿"},
  {id:"d14",date:"Tue Apr 14",city:"Queenstown → Tekapo",      day:"Scenic Drive",                  night:"Mt John Stargazing 9:30pm (Very Cold)", occ:"Casual",  w:"Cold", e:"🌟"},
  {id:"d15",date:"Wed Apr 15",city:"Tekapo → Mt Cook → Tekapo",day:"Glacier Landing Flight 12:30pm",night:"Casual (Cold)",                         occ:"Hiking",  w:"Cold", e:"🏔️"},
  {id:"d16",date:"Thu Apr 16",city:"Tekapo → Christchurch",    day:"Scenic Drive",                  night:"Casual",                                occ:"Casual",  w:"Cold", e:"🚗"},
  {id:"d17",date:"Fri Apr 17",city:"Christchurch → Auckland",day:"Flight · Arrival",             night:"Casual",                          occ:"Dinner",  w:"Mild", e:"🌃"},
  {id:"d18",date:"Sat Apr 18",city:"Auckland",               day:"Hobbiton + Glowworm Caves",    night:"Casual",                          occ:"Casual",  w:"Mild", e:"🧙"},
  {id:"d19",date:"Sun Apr 19",city:"Auckland",               day:"Relax · Viaduct Harbour",       night:"Smart Casual Dinner",             occ:"Casual",  w:"Mild", e:"⛵"},
  {id:"d20",date:"Mon Apr 20",city:"Auckland → Delhi",       day:"Departure Flight",              night:"Flight (Long Haul)",              occ:"Flight",  w:"Mild", e:"✈️"},
];

export default TRIP;
