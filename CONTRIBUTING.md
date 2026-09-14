# Contributing

Thank you for helping improve [Kabakoo Academies’](https://www.kabakoo.africa/) [AI for livelihoods playbook](https://playbook.kabakoo.africa/).

For a correction, open an issue with the chapter, passage, proposed correction, and supporting source. For a substantial addition or translation, open an issue describing the audience and scope before preparing a full draft. Kabakoo reviews contributions before incorporating them into the published edition.

Edit the `.qmd` source or the relevant asset and run `python3 scripts/build.py`. Submit a pull request that explains the reader-facing change and how it was checked. Include browser verification for changes to navigation, styles, or working tools; see [BROWSER-CHECKS.md](BROWSER-CHECKS.md). Generated output is excluded from Git. A merged change does not automatically deploy the public website.

Preserve evidence citations, the scope and date of reported findings, and the distinction between actual observations and example exercises. Do not introduce learner contact details, private conversation records, access credentials, or internal research material in issues or contributions. Use the already published, prepared illustrations and interface examples when discussing the edition.

Text, worksheets, and original explanatory-drawing contributions use CC BY-SA 4.0; code contributions use Apache-2.0. Submit only material you have the right to share. Fonts and documentary or brand assets retain their separate terms in [ASSETS.md](ASSETS.md).

For adaptations, identify your changes and retain credit to [Kabakoo Academies](https://www.kabakoo.africa/) and a link to the [original playbook](https://playbook.kabakoo.africa/). Make your edition’s relationship to the original clear. If you publish it at another address, set `PLAYBOOK_URL` and `book.site-url` in `_quarto.yml` to your edition’s full base URL, and update `CITATION.cff` and the citation in `versions.qmd`. Keep the attribution links to Kabakoo’s original edition.

For questions that should not be public, contact [akwaba@kabakoo.africa](mailto:akwaba@kabakoo.africa).
