(() => {
  'use strict';
  const chapter = document.querySelector('.daylight');
  const board = document.getElementById('idea-board');
  if (!chapter || !board) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const buttons = [...document.querySelectorAll('.business-picker [data-business]')];
  // Made-up brands. The page HTML carries the café, so the board reads without script.
  const ideas = {
    cafe: { brand:'Ember & Oat', place:'a neighbourhood café',
      siteHeadline:'Coffee worth getting up for.', siteAction:'Order for pickup', siteNote:'A menu site that takes pickup orders.',
      toolTitle:'Today’s orders', toolCount:'12 new', row1:'Oat flat white × 2', row1Status:'Ready', row2:'Sourdough toastie', row2Status:'Making', row3:'Cinnamon bun box', row3Status:'Queued', toolNote:'Orders land straight in the kitchen.',
      question:'Are you open on Sunday?', answer:'Yes! 8am to 3pm. Want me to save you a table?', chatNote:'Answers the usual questions, even at midnight.',
      filmTag:'0:15 · REEL', filmTitle:'Fresh at 7am.', filmNote:'Short reels that make people hungry.' },
    clinic: { brand:'Stillwater Physio', place:'a physiotherapy clinic',
      siteHeadline:'Feel like yourself again.', siteAction:'Book a session', siteNote:'Online booking, without the phone tag.',
      toolTitle:'Your recovery plan', toolCount:'Week 3', row1:'Morning stretches', row1Status:'Done', row2:'Strength set B', row2Status:'Today', row3:'Check-in call', row3Status:'Friday', toolNote:'A portal where clients follow their plan.',
      question:'Can I move my 10am to Thursday?', answer:'Done. You’re booked for Thursday at 10:00. See you then!', chatNote:'Rescheduling, handled while you treat patients.',
      filmTag:'1:20 · EXPLAINER', filmTitle:'Your first visit.', filmNote:'A calm explainer that settles first-day nerves.' },
    shop: { brand:'Field & Thread', place:'an independent homeware brand',
      siteHeadline:'Made slowly. Made to last.', siteAction:'Add to bag', siteNote:'A shop that makes buying feel easy.',
      toolTitle:'Stock check', toolCount:'3 low', row1:'Linen tote, natural', row1Status:'3 left', row2:'Wool throw, rust', row2Status:'Reorder', row3:'Stoneware mugs', row3Status:'In stock', toolNote:'Stock and orders in one calm dashboard.',
      question:'Write a description for the rust wool throw.', answer:'Heavy, warm, and woven to soften a little more every winter…', chatNote:'First drafts of product copy in seconds.',
      filmTag:'0:30 · PRODUCT FILM', filmTitle:'Unboxed.', filmNote:'Product films that show the texture.' },
    property: { brand:'Northlight Homes', place:'a boutique estate agency',
      siteHeadline:'Find the light you’ve been missing.', siteAction:'Book a viewing', siteNote:'Listings people actually want to scroll.',
      toolTitle:'This week’s viewings', toolCount:'9 booked', row1:'14 Alder Lane', row1Status:'Tue 10:00', row2:'Unit 4B, The Mill', row2Status:'Wed 17:30', row3:'2 Harbour View', row3Status:'Sat 11:00', toolNote:'Viewings and follow-ups in one place.',
      question:'Anything with three bedrooms and a garden?', answer:'Four homes match. Shall I send them over with viewing times?', chatNote:'Matches enquiries to listings, day or night.',
      filmTag:'360° · VIRTUAL TOUR', filmTitle:'Walk through 4B.', filmNote:'Tours people can take from the sofa.' }
  };
  let current = chapter.dataset.business;
  let run = 0;
  let animations = [];

  function fill(key) {
    const idea = ideas[key];
    chapter.dataset.business = key;
    chapter.querySelectorAll('[data-idea]').forEach(element => {
      const value = idea[element.dataset.idea];
      if (value !== undefined) element.textContent = value;
    });
    board.setAttribute('aria-label', `Ideas for ${idea.brand}, ${idea.place}`);
  }

  async function choose(key) {
    if (key === current || !ideas[key]) return;
    current = key;
    const ticket = ++run;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.business === key)));
    animations.forEach(animation => animation.cancel());
    const pieces = [...board.querySelectorAll('.board-note,.idea')];
    if (motion.matches || typeof board.animate !== 'function') { fill(key); return; }
    // Pieces lift off the board, change, and settle back one after another.
    animations = pieces.map((piece, i) => piece.animate(
      [{ opacity:1, translate:'0 0' }, { opacity:0, translate:'0 -12px' }],
      { duration:170, delay:i * 25, easing:'ease-in', fill:'forwards' }
    ));
    try { await Promise.all(animations.map(animation => animation.finished)); } catch (_) { return; }
    if (ticket !== run) return;
    fill(key);
    animations.forEach(animation => animation.cancel());
    animations = pieces.map((piece, i) => piece.animate(
      [{ opacity:0, translate:'0 18px' }, { opacity:1, translate:'0 0' }],
      { duration:520, delay:i * 70, easing:'cubic-bezier(.2,.75,.2,1)', fill:'backwards' }
    ));
  }

  buttons.forEach(button => button.addEventListener('click', () => choose(button.dataset.business)));
  motion.addEventListener('change', () => { if (motion.matches) animations.forEach(animation => animation.finish()); });
})();
