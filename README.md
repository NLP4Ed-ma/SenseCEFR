# SenseCEFR: Context-Aware Vocabulary Profiler with AI Word Sense Disambiguation

<p align="center">
  <img src="img/nlp4ed.svg" alt="NLP4Ed Logo" width="220" />
</p>

<p align="center">
  <strong>A data-driven CEFR vocabulary profiler that solves the <em>Polysemy Flatline Problem</em> by disambiguating word senses (A1 to C2) in context.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://github.com/NLP4Ed-ma/SenseCEFR"><img src="https://img.shields.io/badge/Release-v0.4%20Beta-blue.svg" alt="Version"></a>
  <a href="https://nlp4ed-ma.github.io/SenseCEFR/"><img src="https://img.shields.io/badge/Live%20App-SenseCEFR%200.4-emerald.svg" alt="Live App SenseCEFR 0.4"></a>
  <a href="index.html"><img src="https://img.shields.io/badge/Execution-100%25%20Client--Side-teal.svg" alt="Client-Side"></a>
</p>

---

## Demo Walkthrough

<p align="center">
  <img src="sensecefr_demo.gif" alt="SenseCEFR Demo Walkthrough" width="100%" style="border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.1);" />
</p>

---

## The Problem: The "Polysemy Flatline"

Standard CEFR text profilers (such as VocabKitchen or conventional wordlist matchers) assign each word a static difficulty level based solely on lemma frequency. This creates the **Polysemy Flatline**: polysemous words are systematically flattened to their lowest, beginner level regardless of how they are used.

Consider how the word **party** shifts difficulty across contexts:

| Sentence Context | Traditional Profiler | SenseCEFR (Context-Aware) | Actual Pedagogical Meaning |
| :--- | :---: | :---: | :--- |
| *"We celebrated at a wonderful birthday **party** with my best friends."* | **A1** | **A1** | Social celebration |
| *"Both political **parties** debated the election campaign vigorously."* | **A1** *(Incorrect)* | **B1** | Political organization |
| *"The binding contract was formally signed by each legal **party**."* | **A1** *(Incorrect)* | **C1** | Legal entity / contracting body |

By misclassifying advanced academic or legal senses as beginner vocabulary, traditional tools severely underestimate the true linguistic difficulty of textbooks, graded readers, examinations, and student essays.

---

## How SenseCEFR Solves It

SenseCEFR analyzes entire sentences to identify multi-tier polysemous tokens and resolves their exact CEFR level (A1 to C2) through a two-tier hybrid architecture:

```
                       Input Text
                           │
             [Tokenizer & Sentence Splitter]
                           │
             [Rule-Based Lemmatization]
             (O(1) inflection map + suffix heuristics)
                           │
             [Polysemy Discrepancy Gate]
             Does lemma span multiple CEFR levels?
                    /             \
                  NO               YES (15-20% of tokens)
                  │                 │
           [Direct Lookup]   [Word Sense Disambiguation]
           (0ms, instant)    • Local Context Matcher (Built-in)
                             • Google Gemini AI Contextual Reasoning
                                    │
                       [CEFR Level Tier Assignment]
                       (A1, A2, B1, B2, C1, C2)
                                    │
                       [Click-to-Inspect Modal]
                       • Guideword & Sense Definition
                       • Candidate sense levels & Confidence score
                       • Manual level selection with live recalculation
```

---

## Key Features

### 1. Accurate Multi-Tier Profiling (A1 to C2)
* Evaluates tokens across the CEFR scale: **A1**, **A2**, **B1**, **B2**, **C1**, and **C2**.
* **Off-list**: Terms outside the pedagogical corpus are clearly distinguished.
* **Unresolved Senses**: Ambiguous or unmapped senses are flagged with `⚑` for immediate pedagogical review.

### 2. Context-Aware Sense Marker (`✦`)
Tokens whose difficulty level was adjusted through word sense disambiguation are marked with `✦` so educators and linguists can easily identify where context altered the vocabulary tier.

### 3. Interactive Word Inspector Modal
Click any profiled token to open the Word Inspector:
* View the active dictionary definition, guideword, and assigned CEFR tier.
* Inspect context confidence scores (e.g. `98% Context Match`).
* Review rejected candidate senses with the option to click **✓ Select this Sense** to manually override the level. All profile metrics and distributions update in real time.

### 4. Custom Lexicon & Curriculum Manager
Open **Settings** (gear icon) to access the built-in lexicon customization center:
* **Single Word Overrides**: Assign custom CEFR levels to emerging or domain-specific terminology (e.g. `blockchain` → `C1`).
* **Multi-Sense Polysemy**: Define multiple senses for a single word with distinct CEFR tiers, parts of speech, guidewords, and definitions. Both the local matcher and Gemini AI will automatically disambiguate between them.
* **CSV Import & Backup**: Bulk import vocabulary lists directly from Excel/Google Sheets, export timestamped backups, or reset to factory defaults with 1 click.

### 5. Google Gemini AI Integration
Optionally connect your Google Gemini API key (e.g., `gemini-flash-lite-latest`) for:
* Zero-shot deep reasoning on complex figurative, idiomatic, and metaphorical usage.
* Plain-English pedagogical rationales explaining why a sense was selected.

### 6. One-Click Spreadsheet Reports
Click **Save Report** to generate a comprehensive CSV report containing token counts, type-token ratios, CEFR distributions, and a complete audit log of all disambiguated polysemous words.

---

## Lexical Coverage

SenseCEFR harmonizes multiple academic corpora:
* **8,889 total headwords** (CEFR-J 1.5, Octanove C1/C2, WordNet-CEFR, and Academic Word List overlay).
* **1,206 polysemous multi-CEFR words** with **3,936 distinct sense definitions and contextual collocation vectors**.
* **105 phrasal verb constructions** (e.g., *bank on*, *figure out*, *look after*, *carry out*).
* **32,013 inflection-to-lemma pairings** for instant $O(1)$ morphological resolution.

---

## Quick Start

### Option 1: Live Web Application
Access the profiler directly in your web browser:
[**https://nlp4ed-ma.github.io/SenseCEFR/**](https://nlp4ed-ma.github.io/SenseCEFR/)

### Option 2: Offline Local Execution
Download the source code as a ZIP (or clone this repository) and open **[`index.html`](index.html)** in any web browser:
```bash
git clone https://github.com/NLP4Ed-ma/SenseCEFR.git
cd SenseCEFR
```

---

## Citation

If you use SenseCEFR in academic research, textbook leveling, or curriculum design, please cite it using [`CITATION.cff`](CITATION.cff) or the following BibTeX entry:

```bibtex
@software{sensecefr2026,
  author       = {Lchgary, Yassine},
  title        = {SenseCEFR: Context-Aware Vocabulary Profiler with Word Sense Disambiguation},
  year         = {2026},
  version      = {0.4.0},
  url          = {https://nlp4ed-ma.github.io/SenseCEFR/}
}
```

---

## Datasets, Papers & Preprints

### Datasets
1. **CEFR-Annotated WordNet**: Kikuchi et al. &mdash; Sense-level CEFR proficiency annotations dataset. [Hugging Face](https://huggingface.co/datasets/star092304/CEFR-Annotated-WordNet)
2. **Princeton WordNet & Morphy**: Miller et al. &mdash; Lexical database and morphological exception database. [https://wordnet.princeton.edu/](https://wordnet.princeton.edu/)
3. **CEFR-J Lexical Database (v1.5)**: Tokyo Univ. of Foreign Studies &mdash; Core A1–B2 vocabulary framework. [http://www.cefr-j.org/](http://www.cefr-j.org/)
4. **CEFR Framework Standards & Companion Volume**: Council of Europe &mdash; Language proficiency descriptors and illustrative scales. [https://www.coe.int/en/web/common-european-framework-reference-languages](https://www.coe.int/en/web/common-european-framework-reference-languages)
5. **Mihalcea WSD Corpora & Resources**: Rada Mihalcea &mdash; Word Sense Disambiguation evaluation benchmarks and lexical resources. [https://web.eecs.umich.edu/~mihalcea/downloads.html](https://web.eecs.umich.edu/~mihalcea/downloads.html)
6. **Octanove C1/C2 Profiles**: Octanove Labs &mdash; Advanced open language profiles lexical dataset. [https://github.com/octanove/c1-c2-vocabulary](https://github.com/octanove/c1-c2-vocabulary)
7. **Oxford 3000™ / 5000™ Wordlists**: Oxford University Press &mdash; Graded vocabulary, sense definitions, and guidewords. [https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000](https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000)

### Papers & Preprints
1. **Kikuchi et al. (2024)**: Kikuchi, M., Ono, M., Soga, T., Tanabe, T., & Ozono, T. (2024). CEFR-Annotated WordNet: LLM-Based Proficiency-Guided Semantic Database for Language Learning. *arXiv preprint arXiv:2510.18466*. [https://doi.org/10.48550/arXiv.2510.18466](https://doi.org/10.48550/arXiv.2510.18466)
2. **Lesk (1986)**: Lesk, M. (1986). Automatic sense disambiguation using machine-readable dictionaries: How to tell a pine cone from an ice cream cone. In *Proceedings of the 5th Annual International Conference on Systems Documentation (SIGDOC '86)* (pp. 24–26). Association for Computing Machinery. [https://doi.org/10.1145/318723.318728](https://doi.org/10.1145/318723.318728)

3. **Negishi, Takada, & Tono (2013)**:  
   Negishi, M., Takada, T., & Tono, Y. (2013). A progress report on the development of the CEFR-J. In N. Saville & F. Sheehan (Eds.), *Critical issues in language testing: Studies in language testing* (Vol. 36, pp. 135–163). Cambridge University Press. [http://www.cefr-j.org/](http://www.cefr-j.org/)

4. **Miller (1995)**:  
   Miller, G. A. (1995). WordNet: A lexical database for English. *Communications of the ACM*, *38*(11), 39–41. [https://doi.org/10.1145/219717.219748](https://doi.org/10.1145/219717.219748)

5. **Council of Europe (2001, 2020)**:  
   Council of Europe. (2001, 2020). *Common European Framework of Reference for Languages: Learning, teaching, assessment – Companion volume*. Council of Europe Publishing. [https://www.coe.int/en/web/common-european-framework-reference-languages](https://www.coe.int/en/web/common-european-framework-reference-languages)

6. **Mihalcea (2007)**:  
   Mihalcea, R. (2007). Using Wikipedia for automatic word sense disambiguation. In *Human Language Technologies 2007: NAACL-HLT Companion Volume* (pp. 197–200). Association for Computing Machinery. [https://web.eecs.umich.edu/~mihalcea/downloads.html](https://web.eecs.umich.edu/~mihalcea/downloads.html)

---

## License

This project is licensed under the [MIT License](LICENSE).

### Acknowledgments & Dataset Credits
- **Princeton WordNet**: WordNet 3.0 Copyright 2006 by Princeton University.
- **Octanove C1/C2**: Octanove Labs, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **CEFR-Annotated WordNet**: Kikuchi et al., licensed under [CC BY 4.0](https://creativecommons.org/licenses/by-4.0/).
- **Oxford 3000™ / 5000™**: Trademarks of Oxford University Press (referenced for academic comparison).
