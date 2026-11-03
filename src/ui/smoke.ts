import { Character } from './characters';
import { ROOT } from './root';

// A pipe smoker's joke, played as a clip is: the portrait turns to the picture with the pipe in
// their mouth, and smoke rises from the bowl for a while, the way steam rises from a cup of coffee.
// The smoke is laid over the portrait, cut to its frame, and keeps to it if the table is laid out
// afresh meanwhile. Its look is in style.css, under `.smoke`.

const PUFFING_MS = 9000; // how long the smoke keeps coming
const FADE_MS = 1200; // how long the last of it takes to clear

/**
 * Smokes a character's pipe on their portrait. `change` puts a new picture on the portrait.
 * Returns a function that cuts this short; `done` is called once either way, and should put the
 * portrait's own picture back.
 */
export function playSmoke(
  el: HTMLImageElement,
  who: Character,
  change: (src: string) => void,
  done: () => void,
): () => void {
  const { picture, x, y } = who.smoke!;
  const cloud = document.createElement('div');
  cloud.className = 'smoke';
  cloud.innerHTML = '<span></span><span></span><span></span>';
  cloud.style.setProperty('--x', `${x}%`);
  cloud.style.setProperty('--y', `${y}%`);
  let running = true;

  /** Keeps the smoke over the portrait, wherever it is and however large. */
  const follow = (): void => {
    if (!running) return;
    cloud.style.left = el.style.left;
    cloud.style.top = el.style.top;
    cloud.style.width = cloud.style.height = el.style.width;
    cloud.style.setProperty('--s', el.style.width);
    cloud.hidden = el.hidden;
    requestAnimationFrame(follow);
  };

  /** Clears the smoke away. Cut short, the portrait is handed back at once; else once it is gone. */
  const end = (fade: number, early: boolean): void => {
    if (!running) return;
    running = false;
    clearTimeout(timer);
    const clearing = cloud.animate({ opacity: [1, 0] }, { duration: fade, easing: 'ease-out', fill: 'forwards' });
    clearing.onfinish = () => {
      cloud.remove();
      if (!early) done();
    };
    if (early) done();
  };

  el.after(cloud); // before the change, so that the old picture fading out goes under the smoke
  change(`${ROOT}avatars/${who.id}/${picture}.webp`);
  follow();
  const timer = setTimeout(() => end(FADE_MS, false), PUFFING_MS);
  return () => end(250, true);
}
