/**
 * Pure JavaScript Part-of-Speech Tagger
 * Implements lexical classification + contextual transformation rules
 */
class POSTagger {
  constructor(lexicon) {
    this.lexicon = lexicon;
    this.CLOSED_CLASS = {
      // personal and object pronouns
      'i': 'PRON', 'you': 'PRON', 'he': 'PRON', 'she': 'PRON', 'it': 'PRON',
      'we': 'PRON', 'they': 'PRON', 'me': 'PRON', 'him': 'PRON', 'her': 'PRON',
      'us': 'PRON', 'them': 'PRON', 'myself': 'PRON', 'himself': 'PRON',
      'herself': 'PRON', 'itself': 'PRON', 'ourselves': 'PRON', 'themselves': 'PRON',
      'yourself': 'PRON', 'yourselves': 'PRON', 'who': 'PRON', 'whom': 'PRON',
      // determiners, articles, and possessive pronouns
      'my': 'DET', 'your': 'DET', 'his': 'DET', 'our': 'DET', 'their': 'DET', 'its': 'DET',
      'whose': 'DET', 'a': 'DET', 'an': 'DET', 'the': 'DET', 'every': 'DET', 'each': 'DET',
      'all': 'DET', 'some': 'DET', 'any': 'DET', 'no': 'DET', 'another': 'DET',
      'this': 'DET', 'that': 'DET', 'these': 'DET', 'those': 'DET',
      // common prepositions
      'of': 'ADP', 'in': 'ADP', 'on': 'ADP', 'at': 'ADP', 'by': 'ADP', 'for': 'ADP',
      'with': 'ADP', 'about': 'ADP', 'against': 'ADP', 'between': 'ADP', 'into': 'ADP',
      'through': 'ADP', 'during': 'ADP', 'before': 'ADP', 'after': 'ADP', 'above': 'ADP',
      'below': 'ADP', 'to': 'ADP', 'from': 'ADP', 'up': 'ADP', 'down': 'ADP',
      'off': 'ADP', 'over': 'ADP', 'under': 'ADP', 'without': 'ADP',
      // coordinating and subordinating conjunctions
      'and': 'CONJ', 'but': 'CONJ', 'or': 'CONJ', 'yet': 'CONJ', 'so': 'CONJ',
      'because': 'CONJ', 'although': 'CONJ', 'though': 'CONJ', 'while': 'CONJ', 'if': 'CONJ',
      'unless': 'CONJ', 'since': 'CONJ',
      // auxiliary verbs and modals
      'will': 'AUX', 'would': 'AUX', 'shall': 'AUX', 'should': 'AUX', 'can': 'AUX',
      'could': 'AUX', 'may': 'AUX', 'might': 'AUX', 'must': 'AUX',
      'is': 'AUX', 'am': 'AUX', 'are': 'AUX', 'was': 'AUX', 'were': 'AUX',
      'be': 'AUX', 'been': 'AUX', 'being': 'AUX',
      'have': 'AUX', 'has': 'AUX', 'had': 'AUX',
      'do': 'AUX', 'does': 'AUX', 'did': 'AUX'
    };
  }

  tagWords(words) {
    if (!words || words.length === 0) return [];

    // initial tag pass based on closed-class words and common suffixes
    const tags = words.map(w => {
      const lower = w.toLowerCase().replace(/[\u2018\u2019\u02BC\u02BB]/g, "'");
      if (this.CLOSED_CLASS[lower]) return this.CLOSED_CLASS[lower];
      if (/^\d+$/.test(lower)) return 'NUM';

      // derivational suffix heuristics
      if (lower.endsWith('ly') && lower.length > 3) return 'ADV';
      if (lower.endsWith('tion') || lower.endsWith('sion') || lower.endsWith('ment') || lower.endsWith('ness') || lower.endsWith('ity')) return 'NOUN';
      if (lower.endsWith('able') || lower.endsWith('ible') || lower.endsWith('ful') || lower.endsWith('less') || lower.endsWith('ous')) return 'ADJ';
      if (lower.endsWith('ed') && lower.length > 3 && lower !== 'red' && lower !== 'bed') return 'VERB';
      if (lower.endsWith('ize') || lower.endsWith('ise') || lower.endsWith('ify')) return 'VERB';

      // fall back to dictionary lookup
      if (this.lexicon) {
        const poly = this.lexicon.polysemous[lower];
        const mono = this.lexicon.monosemous[lower];
        const posStr = (poly && poly.pos) || (mono && mono.pos) || '';
        if (posStr.startsWith('verb')) return 'VERB';
        if (posStr.startsWith('noun')) return 'NOUN';
        if (posStr.startsWith('adj')) return 'ADJ';
        if (posStr.startsWith('adv')) return 'ADV';
      }
      return 'NOUN';
    });

    // second pass refining tags with local context
    for (let i = 0; i < words.length; i++) {
      const w = words[i].toLowerCase().replace(/[\u2018\u2019\u02BC\u02BB]/g, "'");
      const prev = i > 0 ? words[i - 1].toLowerCase().replace(/[\u2018\u2019\u02BC\u02BB]/g, "'") : '';
      const prevTag = i > 0 ? tags[i - 1] : '';
      const next = i < words.length - 1 ? words[i + 1].toLowerCase().replace(/[\u2018\u2019\u02BC\u02BB]/g, "'") : '';
      const nextTag = i < words.length - 1 ? tags[i + 1] : '';

      // a word between a determiner and a verb or preposition is usually a noun
      if ((prevTag === 'DET' || prev.endsWith("'s")) && (nextTag === 'VERB' || nextTag === 'ADP' || !next)) {
        tags[i] = 'NOUN';
      }
      // a word between a determiner and a noun acts as an adjective
      else if (prevTag === 'DET' && (nextTag === 'NOUN' || nextTag === 'ADJ')) {
        tags[i] = 'ADJ';
      }
      // words preceded by the infinitive marker to are verbs, except known place nouns
      else if (prev === 'to' && !['school', 'bed', 'church', 'work', 'hospital', 'prison', 'college', 'university', 'sleep'].includes(w)) {
        tags[i] = 'VERB';
      }
      // words following an auxiliary verb or subject pronoun are likely verbs
      else if ((prevTag === 'AUX' || prevTag === 'PRON') && (tags[i] === 'NOUN' || tags[i] === 'VERB')) {
        tags[i] = 'VERB';
      }
      // subject followed by an adverb and a verb, like I finally saw or he quickly ran
      else if (prevTag === 'ADV' && i > 1 && (tags[i - 2] === 'PRON' || tags[i - 2] === 'NOUN')) {
        tags[i] = 'VERB';
      }
      // words preceding a reflexive or object pronoun act as verbs, like film myself
      else if (['myself', 'himself', 'herself', 'itself', 'ourselves', 'themselves', 'me', 'him', 'us', 'them'].includes(next)) {
        tags[i] = 'VERB';
      }
      // ing forms acting as verbs after auxiliaries, pronouns, or start verbs
      else if (w.endsWith('ing') && (prevTag === 'AUX' || prevTag === 'PRON' || prevTag === 'CONJ' || prevTag === 'ADP' || prev === 'while' || prev === 'before' || prev === 'after' || prev === 'when' || prev === 'started' || prev === 'began' || !prev) && !['evening', 'morning', 'building', 'painting', 'ceiling', 'wedding'].includes(w)) {
        tags[i] = 'VERB';
      }
      if (w === 'watching' || w === 'watched') {
        tags[i] = 'VERB';
      }
      // contextual checks for ambiguous roots like saw, light, watch, run, and film
      if (w === 'saw') {
        if (prevTag === 'PRON' || prevTag === 'ADV' || nextTag === 'DET' || nextTag === 'PRON' || next === 'that' || !prev) {
          tags[i] = 'VERB';
        }
      }
      if (w === 'light') {
        if (prev === 'to' || prevTag === 'AUX') {
          tags[i] = 'VERB';
        } else if (prevTag === 'DET' && (nextTag === 'NOUN' || nextTag === 'ADJ')) {
          tags[i] = 'ADJ';
        } else if ((prevTag === 'DET' || prev.endsWith("'s")) && (nextTag === 'ADP' || nextTag === 'VERB' || !next)) {
          tags[i] = 'NOUN';
        }
      }
      if (w === 'used') {
        if (prevTag === 'NOUN' || prevTag === 'PRON' || nextTag === 'DET' || nextTag === 'ADJ' || nextTag === 'NOUN') {
          tags[i] = 'VERB';
        }
      }
      if (w === 'watch' && (prev === 'my' || prev === 'a' || prev === 'the' || prev === 'his' || prev === 'her' || prev === 'keep')) {
        tags[i] = 'NOUN';
      }
      if (w === 'watch' && (prev === 'to' || prevTag === 'PRON' || prevTag === 'AUX')) {
        tags[i] = 'VERB';
      }
      if (w === 'film' && (prevTag === 'DET' || prev === 'favorite' || prev === 'favourite')) {
        tags[i] = 'NOUN';
      }
      if (w === 'film' && (prevTag === 'PRON' || prev === 'to')) {
        tags[i] = 'VERB';
      }
    }

    return tags;
  }
}

/**
 * Natural Language Processing Engine for CEFR Profiling
 */
class NLPEngine {
  constructor(lexicon) {
    this.lexicon = lexicon || 
      (typeof window !== 'undefined' && window.CEFR_LEXICON) || 
      (typeof globalThis !== 'undefined' && globalThis.CEFR_LEXICON) || 
      (typeof CEFR_LEXICON !== 'undefined' ? CEFR_LEXICON : null);

    this.customEntries = [];
    this.customMono = {};
    this.customPoly = {};
    this.customPhrasals = {};

    this.tagger = new POSTagger(this.lexicon);
  }

  /**
   * Set custom user lexicon entries (stored in localStorage or imported via CSV).
   * Supports both simple word overrides (monosemous) and multi-sense polysemy.
   */
  setCustomLexicon(entries) {
    this.customEntries = Array.isArray(entries) ? entries : [];
    this.customMono = {};
    this.customPoly = {};
    this.customPhrasals = {};

    if (this.customEntries.length === 0) return;

    const grouped = {};
    for (const item of this.customEntries) {
      if (!item || !item.word) continue;
      const key = String(item.word).toLowerCase().trim();
      if (!key) continue;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        id: item.id || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        word: key,
        cefr: String(item.cefr || 'Off-list').trim().toUpperCase(),
        pos: String(item.pos || '').trim().toLowerCase(),
        guideword: String(item.guideword || '').trim(),
        definition: String(item.definition || '').trim()
      });
    }

    for (const [key, list] of Object.entries(grouped)) {
      if (key.includes(' ')) {
        // multi-word expressions and phrasal verbs
        this.customPhrasals[key] = {
          cefr: list[0].cefr,
          pos: list[0].pos || 'verb',
          guideword: list[0].guideword || key.toUpperCase(),
          definition: list[0].definition || `Custom multi-word expression "${key}"`
        };
        continue;
      }

      if (list.length === 1) {
        // single level override
        const single = list[0];
        this.customMono[key] = {
          cefr: single.cefr,
          pos: single.pos,
          guideword: single.guideword,
          definition: single.definition || `Custom level assignment for "${key}"`
        };
      } else {
        // custom multi-sense definitions
        const senses = list.map((e, idx) => ({
          id: `custom_${key}_${idx + 1}`,
          cefr: e.cefr,
          pos: e.pos || 'unknown',
          guideword: e.guideword || `SENSE ${idx + 1}`,
          definition: e.definition || ''
        }));
        this.customPoly[key] = {
          lemma: key,
          pos: list[0].pos || 'all',
          hasDiscrepancy: true,
          isCustom: true,
          senses: senses
        };
      }
    }
  }

  /**
   * Rule-based lemmatizer with inflection lookup table + morphological heuristics
   */
  lemmatize(word, posTag = '') {
    if (!word) return '';
    const lower = word.toLowerCase().trim().replace(/[\u2018\u2019\u02BC\u02BB]/g, "'");

    // check custom dictionary first
    if (this.customMono[lower] || this.customPoly[lower] || this.customPhrasals[lower]) {
      return lower;
    }

    // disambiguate common past tense verb forms based on tagger output
    if (lower === 'used' && posTag === 'VERB') return 'use';
    if (lower === 'saw' && posTag === 'VERB') return 'see';

    // strip possessive endings such as dog's becoming dog or friends' becoming friend
    if (lower.endsWith("'s") && lower.length > 2) {
      const base = lower.slice(0, -2);
      if (this.customMono[base] || this.customPoly[base]) return base;
      if (this.lexicon.inflections[base]) return this.lexicon.inflections[base];
      if (this.lexicon.polysemous[base] || this.lexicon.monosemous[base]) return base;
      const stripped = this.lemmatize(base);
      if (stripped) return stripped;
    }
    if (lower.endsWith("s'") && lower.length > 3) {
      const base = lower.slice(0, -1);
      if (this.customMono[base] || this.customPoly[base]) return base;
      if (this.lexicon.inflections[base]) return this.lexicon.inflections[base];
      if (this.lexicon.polysemous[base] || this.lexicon.monosemous[base]) return base;
      const stripped = this.lemmatize(base);
      if (stripped) return stripped;
    }

    // protect standalone nouns so they are not stripped down to verbs like even or paint
    const PROTECTED_STANDALONE = new Set([
      'evening', 'morning', 'building', 'painting', 'meeting',
      'feeling', 'training', 'meaning', 'ceiling', 'drawing',
      'clothing', 'gathering', 'warning', 'opening', 'saving',
      'belonging', 'understanding', 'setting', 'surroundings', 'wedding'
    ]);
    if (PROTECTED_STANDALONE.has(lower)) {
      if (this.lexicon.polysemous[lower] || this.lexicon.monosemous[lower]) {
        return lower;
      }
    }

    // ignore false morphological stems from archaic tables, such as cola or flatter
    const FALSE_MORPHOLOGICAL_STEMS = new Set([
      'cola', 'flatter', 'hinder', 'stamina', 'minutiae'
    ]);
    if (FALSE_MORPHOLOGICAL_STEMS.has(lower)) {
      return lower;
    }

    // preserve independent graded headwords like best, better, rent, and dive
    if (this.lexicon.polysemous[lower]) {
      return lower;
    }

    // look up inflections in the compiled table
    if (this.lexicon.inflections[lower]) {
      const base = this.lexicon.inflections[lower];
      if (this.customMono[base] || this.customPoly[base]) {
        return base;
      }
      if (this.lexicon.polysemous[base] || this.lexicon.monosemous[base]) {
        return base;
      }
    }

    // check if word is already a recognized headword
    if (this.lexicon.polysemous[lower] || this.lexicon.monosemous[lower]) {
      return lower;
    }

    // fall back to inflection table even if root is absent from the core list
    if (this.lexicon.inflections[lower]) {
      return this.lexicon.inflections[lower];
    }

    // morphological suffix heuristics for regular past, participle, and plural forms
    if (lower.endsWith('ies') && lower.length > 4) {
      const cand = lower.slice(0, -3) + 'y';
      if (this.lexicon.polysemous[cand] || this.lexicon.monosemous[cand]) return cand;
    }
    if (lower.endsWith('es') && lower.length > 3) {
      const cand = lower.slice(0, -2);
      if (this.lexicon.polysemous[cand] || this.lexicon.monosemous[cand]) return cand;
    }
    if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
      const cand = lower.slice(0, -1);
      if (this.lexicon.polysemous[cand] || this.lexicon.monosemous[cand]) return cand;
    }
    if (lower.endsWith('ed') && lower.length > 4) {
      let cand = lower.slice(0, -2);
      if (this.lexicon.polysemous[cand] || this.lexicon.monosemous[cand]) return cand;
      if (cand.length > 2 && cand[cand.length - 1] === cand[cand.length - 2]) {
        const single = cand.slice(0, -1);
        if (this.lexicon.polysemous[single] || this.lexicon.monosemous[single]) return single;
      }
      cand = lower.slice(0, -1); // e.g. appreciated -> appreciate
      if (this.lexicon.polysemous[cand] || this.lexicon.monosemous[cand]) return cand;
    }
    if (lower.endsWith('ing') && lower.length > 4) {
      let cand = lower.slice(0, -3);
      if (this.lexicon.polysemous[cand] || this.lexicon.monosemous[cand]) return cand;
      if (cand.length > 2 && cand[cand.length - 1] === cand[cand.length - 2]) {
        const single = cand.slice(0, -1);
        if (this.lexicon.polysemous[single] || this.lexicon.monosemous[single]) return single;
      }
      cand = lower.slice(0, -3) + 'e'; // e.g. stating -> state
      if (this.lexicon.polysemous[cand] || this.lexicon.monosemous[cand]) return cand;
    }

    return lower;
  }

  /**
   * Parse input text into structured tokens, detect sentence boundaries,
   * run POS tagging, bind phrasal verbs, and prepare for CEFR disambiguation.
   */
  parseText(rawText) {
    if (!rawText) return [];

    // normalize apostrophes, quotation marks, and non-breaking spaces
    const cleanText = rawText
      .replace(/[\u2018\u2019\u02BC\u02BB]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u00A0\u200B\u200C\u200D]/g, ' ');

    const regex = /([a-zA-Z]+(?:'[a-zA-Z]+)?)|([0-9]+)|([^a-zA-Z0-9\s]+)|(\s+)/g;
    let match;
    let sentenceIndex = 0;

    // first pass extracting words, numbers, and punctuation
    const rawMatches = [];
    while ((match = regex.exec(cleanText)) !== null) {
      const [full, word, , punct] = match;
      rawMatches.push({
        text: full,
        isWord: Boolean(word),
        isPunct: Boolean(punct),
        index: match.index
      });
    }

    // second pass grouping tokens into sentences
    let sentenceBuffer = "";
    const sentences = [];
    let currentSentenceStartIndex = 0;

    for (let i = 0; i < rawMatches.length; i++) {
      const item = rawMatches[i];
      sentenceBuffer += item.text;
      if (item.isPunct && /[.!?]/.test(item.text)) {
        sentences.push({
          sentenceId: sentenceIndex++,
          text: sentenceBuffer.trim(),
          start: currentSentenceStartIndex,
          end: item.index + item.text.length
        });
        sentenceBuffer = "";
        currentSentenceStartIndex = item.index + item.text.length;
      }
    }
    if (sentenceBuffer.trim().length > 0) {
      sentences.push({
        sentenceId: sentenceIndex++,
        text: sentenceBuffer.trim(),
        start: currentSentenceStartIndex,
        end: cleanText.length
      });
    }

    // third pass assigning parts of speech across words
    const wordMatches = rawMatches.filter(m => m.isWord);
    const wordTexts = wordMatches.map(w => w.text);
    const posTags = this.tagger.tagWords(wordTexts);
    wordMatches.forEach((wm, idx) => {
      wm.posTag = posTags[idx];
      wm.lemma = this.lemmatize(wm.text, wm.posTag);
    });

    // fourth pass binding multi-word expressions and phrasal verbs
    const phrasalMap = this.lexicon.phrasal_verbs || {};
    const boundPhrasals = new Map();

    for (let i = 0; i < wordMatches.length; i++) {
      const wm = wordMatches[i];
      const base = wm.lemma;

      // check three-word expressions first
      if (i < wordMatches.length - 2) {
        const next1 = wordMatches[i + 1].lemma;
        const next2 = wordMatches[i + 2].lemma;
        const triKey = `${base} ${next1} ${next2}`;
        if (this.customPhrasals && this.customPhrasals[triKey]) {
          boundPhrasals.set(i, { info: this.customPhrasals[triKey], key: triKey, span: 3, isCustom: true });
          continue;
        }
        if (phrasalMap[triKey]) {
          boundPhrasals.set(i, { info: phrasalMap[triKey], key: triKey, span: 3 });
          continue;
        }
      }

      // check contiguous two-word phrasal verbs
      if (i < wordMatches.length - 1) {
        const next1 = wordMatches[i + 1].lemma;
        const biKey = `${base} ${next1}`;
        if (this.customPhrasals && this.customPhrasals[biKey]) {
          boundPhrasals.set(i, { info: this.customPhrasals[biKey], key: biKey, span: 2, isCustom: true });
          continue;
        }
        if (phrasalMap[biKey]) {
          boundPhrasals.set(i, { info: phrasalMap[biKey], key: biKey, span: 2 });
          continue;
        }
      }

      // check separated phrasal verbs with an object pronoun, like figure it out
      if (i < wordMatches.length - 2) {
        const middle = wordMatches[i + 1].text.toLowerCase();
        const next2 = wordMatches[i + 2].lemma;
        if (['it', 'them', 'me', 'him', 'her', 'us', 'this', 'that'].includes(middle)) {
          const sepKey = `${base} ${next2}`;
          if (this.customPhrasals && this.customPhrasals[sepKey]) {
            boundPhrasals.set(i, { info: this.customPhrasals[sepKey], key: sepKey, span: 2, isSeparated: true, sepOffset: 2, isCustom: true });
            continue;
          }
          if (phrasalMap[sepKey]) {
            boundPhrasals.set(i, { info: phrasalMap[sepKey], key: sepKey, span: 2, isSeparated: true, sepOffset: 2 });
            continue;
          }
        }
      }
    }

    // fifth pass building the final token stream with metadata
    const tokens = [];
    let tokenId = 0;

    for (let i = 0; i < rawMatches.length; i++) {
      const item = rawMatches[i];
      if (!item.isWord) {
        tokens.push({
          id: tokenId++,
          text: item.text,
          isWord: false
        });
        continue;
      }

      const rawWord = item.text;
      const lemma = item.lemma;
      const posTag = item.posTag || 'NOUN';

      const sentObj = sentences.find(st => item.index >= st.start && item.index <= st.end);
      const sentenceContext = sentObj ? sentObj.text : rawText;

      const sentWords = sentObj
        ? wordMatches.filter(w => w.index >= sentObj.start && w.index <= sentObj.end)
        : wordMatches;
      const sentWordIdx = sentWords.findIndex(w => w.index === item.index);
      const wordMatchIdx = wordMatches.findIndex(w => w.index === item.index);

      const localWindow = sentWordIdx >= 0
        ? sentWords.slice(Math.max(0, sentWordIdx - 5), Math.min(sentWords.length, sentWordIdx + 6)).map(w => w.text).join(' ')
        : sentenceContext;

      const prevWord = sentWordIdx > 0 ? sentWords[sentWordIdx - 1].text.toLowerCase() : '';
      const prevWord2 = sentWordIdx > 1 ? sentWords[sentWordIdx - 2].text.toLowerCase() : '';
      const nextWord = (sentWordIdx >= 0 && sentWordIdx < sentWords.length - 1) ? sentWords[sentWordIdx + 1].text.toLowerCase() : '';
      const nextWord2 = (sentWordIdx >= 0 && sentWordIdx < sentWords.length - 2) ? sentWords[sentWordIdx + 2].text.toLowerCase() : '';

      // check if token is the head of a bound phrasal verb
      const phrasalBinding = boundPhrasals.get(wordMatchIdx);
      if (phrasalBinding) {
        const pv = phrasalBinding.info;
        const senseObj = {
          id: phrasalBinding.isCustom ? `custom_mwe_${phrasalBinding.key.replace(/\s+/g, '_')}` : `phrasal_${phrasalBinding.key.replace(/\s+/g, '_')}`,
          guideword: `${pv.guideword} (${phrasalBinding.isCustom ? 'CUSTOM MWE' : 'PHRASAL VERB'})`,
          definition: pv.definition,
          cefr: pv.cefr,
          pos: pv.pos || 'verb'
        };

        const polyEntry = this.lexicon.polysemous[lemma];
        if (polyEntry && polyEntry.hasDiscrepancy && !phrasalBinding.isCustom) {
          const existingSense = polyEntry.senses.find(s => s.id === senseObj.id);
          const sensesWithPhrasal = existingSense ? polyEntry.senses : [senseObj, ...polyEntry.senses];

          tokens.push({
            id: tokenId++,
            text: rawWord,
            lemma: lemma,
            isWord: true,
            isPolysemous: true,
            needsWSD: true,
            isPhrasal: true,
            phrasalVerb: phrasalBinding.key,
            phrasalInfo: pv,
            polyEntry: {
              ...polyEntry,
              senses: sensesWithPhrasal
            },
            candidateSenses: sensesWithPhrasal,
            posTag: 'VERB',
            sentenceContext: sentenceContext,
            localWindow: localWindow,
            prevWord: prevWord,
            prevWord2: prevWord2,
            nextWord: nextWord,
            nextWord2: nextWord2,
            cefr: null,
            selectedSense: null,
            confidence: null
          });
          continue;
        }

        tokens.push({
          id: tokenId++,
          text: rawWord,
          lemma: lemma,
          isWord: true,
          isPolysemous: Boolean(phrasalBinding.isCustom ? false : true),
          needsWSD: false, // directly resolved
          isPhrasal: true,
          isCustom: Boolean(phrasalBinding.isCustom),
          phrasalVerb: phrasalBinding.key,
          phrasalInfo: pv,
          posTag: (pv.pos ? pv.pos.toUpperCase() : 'VERB'),
          sentenceContext: sentenceContext,
          localWindow: localWindow,
          prevWord: prevWord,
          prevWord2: prevWord2,
          nextWord: nextWord,
          nextWord2: nextWord2,
          cefr: pv.cefr,
          selectedSense: senseObj,
          confidence: phrasalBinding.isCustom ? '100% (Custom MWE Override)' : '96% (Phrasal Verb Lock)',
          wsdMethod: phrasalBinding.isCustom ? 'Custom Lexicon' : 'Phrasal Verb Engine',
          candidateSenses: [senseObj]
        });
        continue;
      }

      // check user-defined multi-sense words
      const customPolyEntry = this.customPoly && this.customPoly[lemma];
      if (customPolyEntry) {
        tokens.push({
          id: tokenId++,
          text: rawWord,
          lemma: lemma,
          isWord: true,
          isPolysemous: true,
          needsWSD: true,
          isCustom: true,
          polyEntry: customPolyEntry,
          candidateSenses: customPolyEntry.senses,
          posTag: posTag,
          sentenceContext: sentenceContext,
          localWindow: localWindow,
          prevWord: prevWord,
          prevWord2: prevWord2,
          nextWord: nextWord,
          nextWord2: nextWord2,
          cefr: null,
          selectedSense: null,
          confidence: null
        });
        continue;
      }

      // check user-defined single-level overrides
      const customMonoEntry = this.customMono && this.customMono[lemma];
      if (customMonoEntry) {
        tokens.push({
          id: tokenId++,
          text: rawWord,
          lemma: lemma,
          isWord: true,
          isPolysemous: false,
          needsWSD: false,
          isCustom: true,
          cefr: customMonoEntry.cefr,
          definition: customMonoEntry.definition || `Custom level assignment for "${lemma}"`,
          guideword: customMonoEntry.guideword || '',
          pos: customMonoEntry.pos || posTag,
          posTag: posTag,
          wsdMethod: 'Custom Lexicon',
          sentenceContext: sentenceContext
        });
        continue;
      }

      // check built-in polysemy dictionary
      const polyEntry = this.lexicon.polysemous[lemma];
      const monoEntry = this.lexicon.monosemous[lemma];

      if (polyEntry && polyEntry.hasDiscrepancy) {
        tokens.push({
          id: tokenId++,
          text: rawWord,
          lemma: lemma,
          isWord: true,
          isPolysemous: true,
          needsWSD: true,
          polyEntry: polyEntry,
          candidateSenses: polyEntry.senses,
          posTag: posTag,
          sentenceContext: sentenceContext,
          localWindow: localWindow,
          prevWord: prevWord,
          prevWord2: prevWord2,
          nextWord: nextWord,
          nextWord2: nextWord2,
          cefr: null,
          selectedSense: null,
          confidence: null
        });
      } else if (monoEntry) {
        tokens.push({
          id: tokenId++,
          text: rawWord,
          lemma: lemma,
          isWord: true,
          isPolysemous: false,
          needsWSD: false,
          cefr: monoEntry.cefr,
          definition: monoEntry.definition,
          pos: monoEntry.pos,
          posTag: posTag,
          sentenceContext: sentenceContext
        });
      } else {
        tokens.push({
          id: tokenId++,
          text: rawWord,
          lemma: lemma,
          isWord: true,
          isPolysemous: false,
          needsWSD: false,
          cefr: 'Off-list',
          definition: 'Not found in core CEFR graded vocabulary list.',
          posTag: posTag,
          sentenceContext: sentenceContext
        });
      }
    }

    return tokens;
  }
}

if (typeof window !== 'undefined') window.NLPEngine = NLPEngine;
if (typeof globalThis !== 'undefined') globalThis.NLPEngine = NLPEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = { NLPEngine, POSTagger };
