// ⚠️ VENDORED COPY of phe-landing-page/src/options.data.ts (feature/frontend-landing-ui).
// Source of truth for the upload form's controlled vocabularies. The seed script
// (scripts/seed-reference.ts) loads these to populate the DB reference tables so
// frontend dropdowns and backend validation share one vocabulary.
// TODO: once the frontend + backend branches merge, replace this with a shared
// workspace package imported by both, rather than a hand-synced copy.

export type SelectOption = {
  value: string;
  label: string;
};

export const hymn_options = [
  // Kiahk Season - Matins & Vespers
  { value: "verses-of-cymbals-adam", label: "Verses of Cymbals (Adam)" },
  { value: "verses-of-cymbals-watos", label: "Verses of Cymbals (Watos)" },
  { value: "intro-to-doxologies", label: "Intro to Doxologies" },
  { value: "first-doxology-kiahk", label: "First Doxology for Kiahk" },
  { value: "second-doxology-kiahk", label: "Second Doxology for Kiahk" },
  { value: "third-doxology-kiahk", label: "Third Doxology for Kiahk" },
  { value: "fourth-doxology-kiahk", label: "Fourth Doxology for Kiahk" },
  { value: "fifth-doxology-kiahk", label: "Fifth Doxology for Kiahk" },
  { value: "sixth-doxology-kiahk", label: "Sixth Doxology for Kiahk" },
  {
    value: "kiahk-doxology-archangel-michael",
    label: "Kiahk Doxology for Archangel Michael",
  },
  {
    value: "first-secondweek-kiahk-gospel-response",
    label: "Gospel Response (1st & 2nd Week of Kiahk)",
  },
  {
    value: "third-fourthweek-kiahk-gospel-response",
    label: "Gospel Response (3rd & 4th Week of Kiahk)",
  },
  { value: "End of Service Hymn", label: "End of Service Hymn (Kiahk)" },
  // Kiahk Season - Midnight Praises (Saturday)
  {
    value: "intro-to-midnight-praises-tentheeno",
    label: "Intro to Midnight Praises (Tentheeno)",
  },
  { value: "kiahk-ode", label: "Kiahk Ode" },
  { value: "amen-alleluia", label: "Amen Alleluia" },
  {
    value: "adam-psali-on-first-canticle",
    label: " Adam Psali on the First Canticle",
  },
  { value: "the-first-canticle", label: "The First Canticle" },
  {
    value: "adam-psali-for-first-canticle",
    label: "Adam Psali (Lobsh) for the First Canticle",
  },
  {
    value: "hymn-after-first-canticle",
    label: "Hymn After the First Canticle",
  },
  {
    value: "exposition-first-canticle",
    label: "Exposition on the First Canticle",
  },
  {
    value: "adam-psali-on-second-canticle",
    label: "Adam Psali on the Second Canticle",
  },
  { value: "the-second-canticle", label: "The Second Canticle" },
  {
    value: "adam-psali-for-second-canticle",
    label: "Adam Psali (Lobsh) for the Second Canticle",
  },
  {
    value: "hymn-after-second-canticle",
    label: "Hymn After the Second Canticle",
  },
  {
    value: "exposition-second-canticle",
    label: "Exposition on the Second Canticle",
  },
  {
    value: "adam-psali-on-third-canticle",
    label: "Adam Psali on the Third Canticle",
  },
  {
    value: "kiahk-praise-for-holy-trinity",
    label: "Kiahk Praise for the Holy Trinity",
  },
  { value: "the-third-canticle", label: "The Third Canticle" },
  {
    value: "greek-watos-psali-for-three-saintly-children",
    label: "Greek Watos Psali for the Three Saintly Children",
  },
  {
    value: "hymn-after-praise-of-three-young-men",
    label: "Hymn After Praise of the Three Men",
  },
  {
    value: "another-hymn-after-praise-of-three-young-men",
    label: "Another Hymn After Praise of the Three Young Men",
  },
  {
    value: "song-of-the-three-saintly-children",
    label: "The Song of the Three Saintly Children (Tenen)",
  },
  {
    value: "watos-psali-for-three-saintly-children",
    label: "Watos Psali for the Three Saintly Children",
  },
  {
    value: "exposition-third-canticle",
    label: "Exposition on the Third Canticle",
  },
  {
    value: "commemoration-virgin-angels-apostles-martyrs-saints",
    label:
      "Commemoration of the Virgin, the Angels, the Apostles, the Martyrs and the Saints",
  },
  { value: "praise-for-st-anthony", label: "Praise for St. Anthony the Great" },
  {
    value: "praise-for-st-maximus-st-dometius",
    label: "Praise for St. Maximus and St. Dometius",
  },
  { value: "praise-for-st-moses", label: "Praise for St. Moses the Strong" },
  {
    value: "praise-for-st-samuel",
    label: "Praise for St. Samuel the Confessor",
  },
  {
    value: "exposition-on-commemoration-of-saints",
    label: "Exposition on the Commemoration of the Saints",
  },
  {
    value: "adam-psali-on-fourth-canticle",
    label: "Adam Psali on the Fourth Canticle",
  },
  {
    value: "the-fourth-canticle",
    label: "The Fourth Canticle (Esmo E'epchois/E'erof",
  },
  {
    value: "exposition-on-fourth-canticle",
    label: "Exposition on the Fourth Canticle",
  },
  {
    value: "adam-praise-on-sunday-adam-psali-for-lord-jesus",
    label:
      "Adam Praise on the Sunday Adam Psali for the Lord Jesus (I praise the Virgin)",
  },
  {
    value: "i-open-my-mouth-with-praise",
    label: "I Open My Mouth With Praise",
  },
  {
    value: "adam-psali-on-you-are-called",
    label: "Adam Psali on 'You are Called' (Come, O you people...)",
  },
  { value: "the-first-explanation", label: "The First Explanation" },
  { value: "the-second-explanation", label: "The Second Explanation" },
  { value: "the-third-explanation", label: "The Third Explanation" },
  { value: "the-fourth-explanation", label: "The Fourth Explanation" },
  { value: "the-fifth-explanation", label: "The Fifth Explanation" },
  { value: "the-sixth-explanation", label: "The Sixth Explanation" },
  { value: "the-seventh-explanation", label: "The Seventh Explanation" },
  {
    value: "exposition-on-first-you-are-called",
    label: "Exposition on the First 'You are called'",
  },
  {
    value: "exposition-on-second-you-are-called",
    label: "Exposition on the Second 'You are called'",
  },
  {
    value: "kiahk-melody-on-eigth-part-of-sunday-theotokia",
    label: "Kiahk Melody on the Eighth Part of the Sunday Theotokia",
  },
  {
    value: "exposition-on-seven-times-everyday",
    label: "Exposition on 'Seven Times Every Day'",
  },
  { value: "rejoice-o-mary", label: "Rejoice O Mary" },
  { value: "o-mary", label: "O Mary" },
  { value: "o-daughter-of-david", label: "O Daughter of David" },
  {
    value: "adam-psali-on-tenth-part-of-sunday-theotokia",
    label:
      "Adam Psali on the Tenth Part of the Sunday Theotokia 'You are more worthy'",
  },
  { value: "i-praise-the-virgin", label: "I Praise the Virgin" },
  { value: "exposition-of-laborers", label: "Exposition of the Laborers" },
  {
    value: "conclusion-to-exposition-of-laborers",
    label: "Conclusion to the Exposition of the Laborers",
  },
  { value: "your-mercies-o-my-god", label: "Your Mercies O My God" },
  {
    value: "exposition-on-your-mercies-o-my-god",
    label: "Exposition on 'Your mercies, O my God'",
  },
  // Kiahk Season - St. Basil - Liturgy of the Word
  { value: "hiten-archangel-michael", label: "Hiten for Archangel Michael" },
  {
    value: "hiten-john-son-of-zacharias",
    label: "Hiten for John, Son of Zacharias",
  },
  {
    value: "hiten-zacharias-and-elizabeth",
    label: "Hiten for Zacharias and Elizabeth",
  },
  { value: "hiten-joachim-and-anna", label: "Hiten for Joachim and Anna" },
  {
    value: "praxis-response-first-and-third-sunday",
    label: "Praxis Response - 1st and 3rd Sunday",
  },
  {
    value: "praxis-response-second-sunday",
    label: "Praxis Response - 2nd Sunday",
  },
  {
    value: "praxis-response-fourth-sunday",
    label: "Praxis Response - 4th Sunday",
  },
  // Kiahk Season - St. Basil - Liturgy of the Faithful
  {
    value: "gospel-response-first-and-second-sunday",
    label: "Gospel Response - 1st and 2nd Sunday (We send you greetings...)",
  },
  {
    value: "gospel-response-third-and-fourth-sunday",
    label: "Gospel Response - 3rd and 4th Sunday (We exalt you worthily...)",
  },
  {
    value: "aspasmos-adam-first-sunday",
    label: "Aspasmos Adam - 1st Sunday (Zachariah the Priest)",
  },
  {
    value: "aspasmos-adam-second-sunday",
    label: "Aspasmos Adam - 2nd Sunday (You also flew to Saint Mary...)",
  },
  {
    value: "aspasmos-adam-third-sunday",
    label: "Aspasmos Adam - 3rd Sunday (Rejoice, O Mary, handmaiden...)",
  },
  {
    value: "aspasmos-adam-fourth-sunday",
    label: "Aspasmos Adam - 4th Sunday (God is Light...)",
  },
] satisfies ReadonlyArray<{
  value: string;
  label: string;
}>;

export const language_options = [
  { value: "lang-english", label: "English" },
  { value: "lang-coptic", label: "Coptic" },
  { value: "lang-arabic", label: "Arabic" },
] satisfies ReadonlyArray<{
  value: string;
  label: string;
}>;

export const service_options = [
  { value: "vesper-praises", label: "Vesper Praises" },
  { value: "morning-praises", label: "Morning Praises" },
  { value: "midnight-praises", label: "Midnight Praises" },
  { value: "st-basil-liturgy", label: "St. Basil Divine Liturgy" },
  { value: "st-gregory-liturgy", label: "St. Gregory Divine Liturgy" },
  { value: "st-cyril-liturgy", label: "St. Cyril Divine Liturgy" },
  { value: "matins", label: "Matins" },
  { value: "vespers", label: "Vespers" },
  { value: "melodies", label: "Melodies" },
  { value: "ceremony-baptism", label: "Baptism" },
  { value: "ceremony-crowning", label: "Crowning" },
  { value: "unction", label: "Unction" },
  { value: "venerations", label: "Venerations" },
  { value: "funeral", label: "Funeral" },
  { value: "pascha", label: "Pascha" },
  { value: "lakkan", label: "Lakkan" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
] satisfies ReadonlyArray<{
  value: string;
  label: string;
}>;

export const season_options = [
  { value: "annual", label: "Annual" },
  { value: "nairouz", label: "Nairouz" },
  { value: "feast-of-the-cross", label: "Feast of the Cross" },
  { value: "kiahk", label: "Kiahk" },
  { value: "nativity-paramoune", label: "Nativity (Paramoune)" },
  { value: "nativity", label: "Nativity" },
  { value: "feast-of-circumcision", label: "Feast of Circumcision" },
  { value: "epiphany-paramoune", label: "Epiphany (Paramoune)" },
  { value: "epiphany", label: "Epiphany" },
  { value: "wedding-at-cana-of-galilee", label: "Wedding at Cana of Galilee" },
  { value: "lords-entry-into-temple", label: "The Lord's Entry into the Temple" },
  { value: "ninevah-fast", label: "Ninevah's Fast" },
  { value: "ninevah-feast", label: "Ninevah's Feast" },
  { value: "great-lent-saturdays-sundays", label: "Great Lent (Saturdays and Sundays)" },
  { value: "great-lent-weekdays", label: "Great Lent (Weekdays)" },
  { value: "annunciation", label: "Annunciation" },
  { value: "lazarus-saturday", label: "Lazarus Saturday" },
  { value: "palm-sunday", label: "Palm Sunday" },
  { value: "holy-week-general-hours", label: "Holy Week (General Hours)" },
  { value: "holy-week-covenant-thursday", label: "Holy Week (Covenant Thursday)" },
  { value: "holy-week-good-friday", label: "Holy Week (Good Friday)" },
  { value: "bright-saturday", label: "Bright Saturday" },
  { value: "resurrection", label: "Resurrection" },
  { value: "ascension", label: "Ascension" },
  { value: "pentecost", label: "Pentecost" },
  { value: "apostles-fast", label: "Apostles Fast" },
  { value: "apostles-feast", label: "Apostles Feast" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
] satisfies ReadonlyArray<{
  value: string;
  label: string;
}>;
