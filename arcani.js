// Archetipi (solo carte positive) e domande del questionario.
// Ogni risposta dà 2 punti all'archetipo principale e 1 al secondario.
// In caso di parità vince l'archetipo principale della risposta più recente (l'aspirazione pesa di più).

const ARCANI = {
  mago: {
    motto: 'Dove gli altri vedono un limite, tu vedi uno strumento.',
    num: 'I', nome: { m: 'IL MAGO', f: 'LA MAGA' },
    traits: 'ingenuity, creativity, turning ideas into reality',
    simboli: 'a wand raised toward the sky, a table with a cup, a sword, a pentacle and a wand, an infinity symbol of light above the head, roses and lilies',
    testo: 'Hai il dono di trasformare le idee in realtà. Dove gli altri vedono un limite, tu vedi uno strumento.'
  },
  imperatore: {
    motto: 'Guidi con calma, e chi ti sta accanto si sente al sicuro.',
    num: { m: 'IV', f: 'III' }, nome: { m: "L'IMPERATORE", f: "L'IMPERATRICE" },
    traits: 'natural leader, calm authority, protective, responsible',
    simboli: 'a golden scepter, a regal red cloak, a globe under the hand, a castle on a mountain, a radiant golden halo',
    testo: 'Hai un\'autorevolezza calma: non comandi, ma senti la responsabilità di chi ti sta accanto.'
  },
  temperanza: {
    motto: 'Porti equilibrio ovunque vai, e trovi la misura giusta delle cose.',
    num: 'XIV', nome: { m: 'LA TEMPERANZA', f: 'LA TEMPERANZA' },
    traits: 'caring for others, balance, harmony',
    simboli: 'water flowing gracefully between two golden cups, one foot on land and one in a stream, irises, a path toward a sunrise, soft wings of light',
    testo: 'Porti equilibrio ovunque vai. Ti prendi cura degli altri e sai trovare la misura giusta delle cose.'
  },
  stella: {
    motto: 'Guardi lontano, e accendi negli altri la voglia di crederci.',
    num: 'XVII', nome: { m: 'LA STELLA', f: 'LA STELLA' },
    traits: 'inspiration, hope, vision',
    simboli: 'a great eight-pointed star shining above, seven smaller stars, water poured into a calm pool, a starry night sky',
    testo: 'Sei una fonte di ispirazione. Guardi lontano e accendi negli altri la voglia di crederci.'
  },
  sole: {
    motto: 'Porti luce ovunque vai, e la tua gioia è contagiosa.',
    num: 'XIX', nome: { m: 'IL SOLE', f: 'IL SOLE' },
    traits: 'energy, joy, human warmth',
    simboli: 'a great radiant sun behind the figure like a halo, golden sunflowers, a flowing red banner, warm golden light',
    testo: 'Porti luce e energia. Le persone stanno bene accanto a te, e la tua gioia è contagiosa.'
  },
  forza: {
    motto: 'La tua forza non fa rumore: resti in piedi, con gentilezza.',
    num: 'VIII', nome: { m: 'LA FORZA', f: 'LA FORZA' },
    traits: 'courage, resilience, gentle strength',
    simboli: 'a calm lion resting beside the figure under a gentle hand, an infinity symbol of light above the head, a garland of flowers, mountains',
    testo: 'La tua forza non fa rumore. È il coraggio di chi resta in piedi anche quando è dura, con calma e gentilezza.'
  },
  carro: {
    motto: 'Hai una direzione e la segui. Le sfide per te sono la strada.',
    num: 'VII', nome: { m: 'IL CARRO', f: 'IL CARRO' },
    traits: 'ambition, determination, forward motion',
    simboli: 'a triumphant chariot, a starry canopy, a city behind, laurel crown, a road leading forward',
    testo: 'Hai una direzione e la segui. Le sfide per te non sono ostacoli, sono la strada.'
  },
  eremita: {
    motto: 'Sai fermarti ad ascoltare, e la tua luce indica la strada.',
    num: 'IX', nome: { m: "L'EREMITA", f: "L'EREMITA" },
    traits: 'wisdom, listening, reflection',
    simboli: 'a lantern with a shining star inside, a wooden staff, a snowy mountain peak, a deep blue night sky',
    testo: 'Sai ascoltare e sai fermarti a pensare. La tua luce indica la strada a chi ti sta vicino.'
  }
};

const DOMANDE = [
  {
    testo: 'Come ti descrivono gli amici?',
    opzioni: [
      { testo: 'Quello che ha sempre un\'idea', p: 'mago', s: 'sole', en: 'always full of ideas' },
      { testo: 'Quello che si prende cura di tutti', p: 'temperanza', s: 'forza', en: 'takes care of everyone' },
      { testo: 'Quello che prende in mano la situazione', p: 'imperatore', s: 'carro', en: 'takes charge' },
      { testo: 'Quello che sa ascoltare', p: 'eremita', s: 'temperanza', en: 'a great listener' }
    ]
  },
  {
    testo: 'Come ti senti in questo periodo?',
    opzioni: [
      { testo: 'Pieno di energia', p: 'sole', s: 'forza', en: 'full of energy' },
      { testo: 'Ispirato, con nuovi progetti', p: 'stella', s: 'sole', en: 'inspired by new projects' },
      { testo: 'Forte, anche se è dura', p: 'forza', s: 'imperatore', en: 'strong through hard times' },
      { testo: 'Riflessivo, in cerca di risposte', p: 'eremita', s: 'stella', en: 'reflective, searching for answers' }
    ]
  },
  {
    testo: 'Davanti a un ostacolo...',
    opzioni: [
      { testo: 'Lo affronto di petto', p: 'forza', s: 'carro', en: 'faces obstacles head on' },
      { testo: 'Trovo una strada che nessuno ha visto', p: 'mago', s: 'eremita', en: 'finds paths nobody else sees' },
      { testo: 'Organizzo e guido gli altri', p: 'imperatore', s: 'temperanza', en: 'organizes and leads others' },
      { testo: 'Mi fermo, ci penso, poi decido', p: 'eremita', s: 'forza', en: 'thinks before acting' }
    ]
  },
  {
    testo: 'Il tuo posto ideale?',
    opzioni: [
      { testo: 'Una festa piena di gente', p: 'sole', s: 'temperanza', en: 'loves being among people' },
      { testo: 'In viaggio, sempre in movimento', p: 'carro', s: 'mago', en: 'always on the move' },
      { testo: 'Un giardino rigoglioso', p: 'temperanza', s: 'sole', en: 'at peace in nature' },
      { testo: 'Una vetta sotto le stelle', p: 'stella', s: 'eremita', en: 'drawn to high peaks and starry skies' }
    ]
  },
  {
    testo: 'A cosa aspiri davvero?',
    opzioni: [
      { testo: 'Lasciare il segno, guidare', p: 'imperatore', s: 'temperanza', en: 'wants to leave a mark' },
      { testo: 'Vincere le mie sfide', p: 'carro', s: 'forza', en: 'wants to win every challenge' },
      { testo: 'Ispirare gli altri', p: 'stella', s: 'sole', en: 'wants to inspire others' },
      { testo: 'Essere libero di creare', p: 'mago', s: 'sole', en: 'wants freedom to create' }
    ]
  }
];

// Le frasi che il personaggio "dice" richiamano le risposte (usate nel testo della carta)
const ECO = [
  ['Chi ti conosce dice che hai sempre un\'idea.', 'Chi ti conosce sa che ti prendi cura di tutti.', 'Chi ti conosce sa che sei tu a prendere in mano la situazione.', 'Chi ti conosce sa che sai ascoltare.'],
  null, null, null,
  ['E punti a lasciare il segno.', 'E punti a vincere ogni sfida che ti dai.', 'E punti a ispirare chi ti sta intorno.', 'E punti a essere libero di creare.']
];

function calcola(risposte) {
  if (!Array.isArray(risposte) || risposte.length !== DOMANDE.length) throw new Error('risposte non valide');
  const punti = Object.fromEntries(Object.keys(ARCANI).map(k => [k, 0]));
  const scelte = risposte.map((r, i) => {
    const o = DOMANDE[i].opzioni[r];
    if (!o) throw new Error('risposta non valida');
    punti[o.p] += 2; punti[o.s] += 1;
    return o;
  });
  const max = Math.max(...Object.values(punti));
  const pari = Object.keys(punti).filter(k => punti[k] === max);
  // parità: vince l'archetipo principale della risposta più recente tra quelli a pari punti
  const recente = [...scelte].reverse().map(o => o.p).find(k => pari.includes(k));
  const arcano = recente || pari[0];
  return { arcano, punti, scelte };
}

// "L'IMPERATORE" -> "l'Imperatore", "IL MAGO" -> "il Mago"
function nomeInFrase(nome) {
  const cap = w => w.charAt(0) + w.slice(1).toLowerCase();
  if (nome.startsWith("L'")) return "l'" + cap(nome.slice(2));
  const [art, ...rest] = nome.split(' ');
  return art.toLowerCase() + ' ' + rest.map(cap).join(' ');
}

function descrizione(arcano, risposte, genere) {
  const a = ARCANI[arcano];
  const nome = a.nome[genere] || a.nome.m;
  return [
    `Sei ${nomeInFrase(nome)}.`,
    ECO[0][risposte[0]],
    a.testo,
    ECO[4][risposte[4]]
  ].join(' ');
}

module.exports = { ARCANI, DOMANDE, calcola, descrizione };
