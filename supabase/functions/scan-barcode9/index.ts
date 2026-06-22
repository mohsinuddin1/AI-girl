import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ══════════════════════════════════════════════════════
//  STATIC SETS (regulatory facts only — no medical logic)
// ══════════════════════════════════════════════════════

const COSMETIC_MARKERS = new Set([
    'phenoxyethanol', 'fragrance', 'parfum', 'xanthan gum',
    'tocopherol', 'tocopheryl acetate', 'sodium benzoate',
    'potassium sorbate', 'citric acid', 'disodium edta',
    'tetrasodium edta', 'bht', 'bha', 'ethylhexylglycerin',
    'sodium hydroxide', 'ascorbic acid', 'chlorphenesin',
    'caprylyl glycol', 'methylparaben', 'propylparaben',
    'ethylparaben', 'butylparaben', 'isobutylparaben',
    'carbomer', 'benzyl alcohol', 'sorbic acid',
    'dehydroacetic acid', 'benzoic acid'
])

const FOOD_MARKERS = new Set([
    'salt', 'sea salt', 'spices', 'natural flavor',
    'natural flavors', 'artificial flavor', 'artificial flavors',
    'soy lecithin', 'sunflower lecithin', 'xanthan gum',
    'guar gum', 'locust bean gum', 'baking soda',
    'sodium bicarbonate', 'yeast extract', 'citric acid',
    'malic acid', 'lactic acid', 'sodium benzoate'
])

const POISON_OVERRIDE = new Set([
    'lead', 'asbestos', 'hydroquinone', 'mercury',
    'phthalates', 'dibutyl phthalate', 'diethylhexyl phthalate',
    'formaldehyde', 'quaternium-15', 'dmdm hydantoin',
    'imidazolidinyl urea', 'diazolidinyl urea', 'triclosan',
    'coal tar', 'toluene', 'pfas', 'ptfe', 'talc'
])

const SAFE_COSMETIC_MARKERS = new Set([
    'water', 'aqua', 'eau', 'glycerin', 'glycerine', 'glycerol', 'sodium chloride', 'sea salt',
    'citric acid', 'potassium sorbate', 'sodium benzoate', 'xanthan gum',
    'titanium dioxide', 'zinc oxide', 'tocopherol', 'tocopheryl acetate', 'panthenol', 'niacinamide',
    'hyaluronic acid', 'sodium hyaluronate',
    'butylene glycol', 'propylene glycol', 'caprylic/capric triglyceride', 'squalane', 'squalene',
    'dimethicone', 'cyclomethicone', 'cyclopentasiloxane', 'dimethiconol',
    'mica', 'cetearyl alcohol', 'stearic acid', 'carbomer',
    'ci 77891', 'ci 77491', 'ci 77492', 'ci 77499', 'ci 77019', 'ci 77947', 'ci 77007',
    'kaolin', 'illite', 'magnesium myristate', 'calcium carbonate',
    'allantoin', 'ascorbic acid', 'cetyl alcohol', 'stearyl alcohol',
    'glyceryl stearate', 'peg-100 stearate', 'sorbitan olivate', 'cetearyl olivate',
    'coco-glucoside', 'decyl glucoside', 'lauryl glucoside', 'cocamidopropyl betaine',
    'sodium cocoyl isethionate', 'sodium lauroyl sarcosinate', 'caprylyl glycol', 'ethylhexylglycerin',
    'bentonite', 'ascorbyl palmitate', 'sodium pca', 'urea', 'sorbitol', 'trehalose',
    'pullulan', 'algin', 'carrageenan', 'ceramide np', 'ceramide ap', 'ceramide eop',
    'cholesterol', 'phytosphingosine', 'hydrolyzed collagen', 'hydrolyzed elastin', 'hydrolyzed keratin',
    'silk amino acids', 'silica', 'tin oxide',
    'synthetic fluorphlogopite', 'boron nitride', 'nylon-12', 'polymethylsilsesquioxane',
    'isononyl isononanoate', 'isopropyl myristate', 'dicaprylyl carbonate', 'c12-15 alkyl benzoate',
    'isododecane', 'hydrogenated polyisobutene', 'cera microcristallina', 'microcrystalline wax',
    'euphorbia cerifera cera', 'candelilla wax', 'copernicia cerifera cera', 'carnauba wax',
    'natural flavor', 'natural flavors', 'natural flavour',
    'bis-ethylhexyloxyphenol methoxyphenyl triazine', 'bemotrizinol', 'tinosorb s',
    'polysorbate 20', 'polysorbate 60', 'polysorbate 80',
    'phenoxyethanol', 'lactic acid', 'acrylates copolymer', 'acrylates/c10-30 alkyl acrylate crosspolymer',
    'hydroxyethylcellulose', 'disodium edta', 'tetrasodium edta',
    'jojoba oil', 'simmondsia chinensis oil', 'argan oil', 'argania spinosa kernel oil',
    'rosehip oil', 'rosa canina fruit oil', 'aloe barbadensis leaf juice',
    'chamomile extract', 'matricaria chamomilla', 'green tea extract', 'camellia sinensis',
    'cera alba', 'beeswax', 'lanolin', 'petrolatum', 'mineral oil', 'paraffinum liquidum'
])
const SAFE_FOOD_MARKERS = new Set([
    'water', 'aqua', 'eau', 'citric acid', 'baking soda', 'sodium bicarbonate', 'vinegar',
    'pectin', 'guar gum', 'locust bean gum', 'agar', 'agar-agar', 'konjac gum', 'tara gum',
    'inulin', 'chicory root fiber', 'chicory root fibre', 'psyllium husk',
    'ascorbic acid', 'vitamin c', 'sodium ascorbate', 'calcium ascorbate',
    'mixed tocopherols', 'vitamin e', 'malic acid', 'tartaric acid', 'lactic acid', 'acetic acid',
    'potassium sorbate', 'sodium benzoate', 'calcium propionate',
    'sodium citrate', 'potassium citrate', 'calcium citrate',
    'sodium erythorbate', 'xanthan gum', 'gellan gum', 'gum arabic', 'acacia gum', 'acacia',
    'sodium alginate', 'potassium alginate', 'calcium alginate', 'propylene glycol alginate',
    'cellulose gum', 'carboxymethyl cellulose', 'microcrystalline cellulose',
    'methylcellulose', 'hydroxypropyl methylcellulose', 'hpmc',
    'baking powder', 'natural flavor', 'natural flavors', 'natural flavour', 'natural flavours',
    'wheat flour', 'flour', 'rice flour', 'oat flour', 'corn flour', 'maize flour',
    'corn starch', 'cornstarch', 'tapioca starch', 'potato starch', 'modified starch',
    'rice', 'oats', 'barley', 'semolina', 'durum wheat',
    'maltodextrin', 'dextrose', 'lecithin', 'soy lecithin', 'sunflower lecithin',
    'olive oil', 'sunflower oil', 'canola oil', 'rapeseed oil', 'safflower oil', 'sesame oil',
    'coconut oil', 'cocoa butter', 'shea butter',
    'gelatin', 'gelatine', 'yeast', 'baker\'s yeast',
    'vanilla', 'vanilla extract', 'vanillin', 'spices', 'herbs',
    'caramel color', 'caramel colour', 'annatto', 'paprika extract', 'turmeric', 'beta-carotene',
    'mono and diglycerides', 'mono- and diglycerides of fatty acids',
    'calcium carbonate', 'ferrous sulfate', 'ferrous fumarate', 'folic acid', 'riboflavin',
    'thiamine', 'niacin', 'pyridoxine', 'cyanocobalamin', 'biotin'
])

// Common safe food additives (E-numbers) — skip AI, classify instantly as negligible
const SAFE_ADDITIVES = new Set([
    'e100', 'e101', 'e140', 'e141', 'e150a', 'e160a', 'e160c', 'e162', 'e163',
    'e170', 'e200', 'e202', 'e210', 'e211', 'e220', 'e250', 'e260', 'e270',
    'e290', 'e296', 'e300', 'e301', 'e302', 'e304', 'e306', 'e307', 'e308',
    'e309', 'e310', 'e316', 'e322', 'e330', 'e331', 'e332', 'e333', 'e334',
    'e335', 'e336', 'e337', 'e339', 'e340', 'e341', 'e375', 'e392', 'e400',
    'e401', 'e402', 'e406', 'e407', 'e410', 'e412', 'e414', 'e415', 'e416',
    'e418', 'e420', 'e421', 'e422', 'e440', 'e460', 'e461', 'e464', 'e466',
    'e470a', 'e470b', 'e471', 'e472a', 'e472b', 'e472c', 'e472e', 'e473',
    'e500', 'e500i', 'e500ii', 'e501', 'e503', 'e504', 'e507', 'e508',
    'e509', 'e511', 'e514', 'e516', 'e524', 'e551', 'e553', 'e570',
    'e574', 'e575', 'e577', 'e578', 'e627', 'e631', 'e901', 'e903',
    'e920', 'e938', 'e941', 'e942', 'e948', 'e949', 'e1400', 'e1404',
    'e1410', 'e1412', 'e1414', 'e1420', 'e1422', 'e1440', 'e1442',
    'e1450', 'e1451', 'e1505', 'e1510', 'e1520'
])

// ══════════════════════════════════════════════════════
//  REGULATORY DICTIONARY — Verified regulatory data only
//  Replaces AI-generated regulatoryStatus to prevent hallucination.
// ══════════════════════════════════════════════════════

const REGULATORY_DICT: Record<string, { status: string, context: string } | null> = {
    // ── IARC Group 1 — Confirmed human carcinogens ──
    'formaldehyde': { status: 'IARC Group 1 carcinogen', context: 'both' },
    'asbestos': { status: 'IARC Group 1 carcinogen — banned globally', context: 'both' },
    'benzene': { status: 'IARC Group 1 carcinogen', context: 'both' },
    'coal tar': { status: 'IARC Group 1 carcinogen; EU restricted in cosmetics', context: 'cosmetic' },
    // ── EU/FDA Banned ──
    'hydroquinone': { status: 'FDA banned OTC; EU banned in cosmetics', context: 'cosmetic' },
    'mercury': { status: 'FDA and EU banned', context: 'both' },
    'lead': { status: 'Not permitted in cosmetics or food', context: 'both' },
    'lead acetate': { status: 'FDA banned in hair dyes', context: 'cosmetic' },
    // ── Restricted with verified limits ──
    'triclosan': { status: 'FDA banned in OTC antiseptic wash products', context: 'both' },
    'methylparaben': { status: 'EU max 0.4% alone or 0.8% total parabens', context: 'cosmetic' },
    'propylparaben': { status: 'EU max 0.14%', context: 'cosmetic' },
    'butylparaben': { status: 'EU max 0.14%', context: 'cosmetic' },
    'isobutylparaben': { status: 'EU max 0.14%', context: 'cosmetic' },
    'ethylparaben': { status: 'EU max 0.4% alone or 0.8% total parabens', context: 'cosmetic' },
    // ── Confirmed endocrine disruptors ──
    'dibutyl phthalate': { status: 'EU banned in cosmetics; confirmed endocrine disruptor', context: 'cosmetic' },
    'diethylhexyl phthalate': { status: 'EU restricted; confirmed endocrine disruptor', context: 'both' },
    'bisphenol a': { status: 'EU banned in food contact materials for infants', context: 'food' },
    // ── Food-specific ──
    'sodium nitrite': { status: 'Permitted preservative; IARC Group 2A with processed meat', context: 'food' },
    'potassium bromate': { status: 'IARC Group 2B; banned in EU, UK, Canada', context: 'food' },
    'red 3': { status: 'FDA revoked authorization', context: 'food' },
    'red no. 3': { status: 'FDA revoked authorization', context: 'food' },
    'erythrosine': { status: 'FDA revoked authorization', context: 'food' },
    'aspartame': { status: 'IARC Group 2B possible carcinogen; ADI 40mg/kg/day', context: 'food' },
    // ── Fix aspartame framing ──
    'aspartame': { status: 'IARC Group 2B (possible) — approved within ADI by FDA and EFSA', context: 'food' },
    // ── Commonly MISCLASSIFIED by AI — explicitly null ──
    'sodium laureth sulfate': null, 'sodium lauryl sulfate': null,
    'peg-140 hydrogenated castor oil': null, 'peg-40 hydrogenated castor oil': null,
    'shea butter': null, 'cocoa butter': null, 'cocoa seed butter': null,
    'sodium benzoate': null, 'potassium sorbate': null,
    'titanium dioxide': null, 'dimethicone': null,
    'glycerin': null, 'phenoxyethanol': null,
    'citric acid': null, 'xanthan gum': null, 'tocopherol': null,
    // ── UV Filters — permitted, endocrine concern unconfirmed ──
    'ethylhexyl methoxycinnamate': null, 'octinoxate': null,
    'octocrylene': null,
    'benzophenone-4': null,
    'ethylhexyl salicylate': null, 'octyl salicylate': null,
    'homosalate': null,
    'bemotrizinol': null, 'tinosorb s': null,
    // ── Fragrance allergens — sensitizers, NOT carcinogens ──
    'hexyl cinnamal': null, 'hexyl cinnamaldehyde': null,
    'benzyl benzoate': null,
    'coumarin': null,
    'citral': null,
    'linalool': null,
    'limonene': null,
    'geraniol': null,
    'eugenol': null,
    'cinnamaldehyde': null,
    'isoeugenol': null,
    'cinnamyl alcohol': null,
    'farnesol': null,
    'amyl cinnamal': null,
    // ── Hair dye intermediates — sensitizers, NOT IARC carcinogens ──
    'p-phenylenediamine': null, 'ppd': null,
    'm-aminophenol': null,
    'resorcinol': null,
    'o-aminophenol': null,
    // ── Food sweeteners — safe within ADI ──
    'steviol glycosides': null, 'steviol': null, 'stevia': null,
    'sucralose': null, 'acesulfame k': null, 'acesulfame potassium': null,
    // ── Aerosol propellants — not allergens ──
    'butane': null, 'propane': null, 'isobutane': null,
    // ── Common cosmetic preservatives — irritation possible, not banned ──
    'alcohol denat.': null, 'denatured alcohol': null,
    'sulfur': null,
    'piroctone olamine': null,
    'cocamide mea': null,
    // ── Food colours — approved ──
    'e150d': null, 'caramel color class iv': null, 'caramel color': null,
    'caramel colour': null,
    // ── Hair dye agents — IARC Group 3 misuse targets ──
    'hexadimethrine chloride': null,
    '2,4-diaminophenoxyethanol hcl': null, '2,4-diaminophenoxyethanol hci': null,
    '4,4-diaminodiphenylamine sulfate': null,
    'ammonium hydroxide': null,
    'ethanolamine': null,
    'ammonium thioglycolate': null,
    'thioglycolic acid': null,
    'ci 77891': null,
    'ci 77491': null,
    'ci 77492': null,
    'ci 77499': null,
    'propylene glycol': null,
    'bht': null,
    'aluminum hydroxide': null,
    'parfum': null,
}

// ══════════════════════════════════════════════════════
//  ALLERGEN EXCLUSION LIST — Prevents false positive allergen matches
// ══════════════════════════════════════════════════════

const ALLERGEN_EXCLUSIONS: Record<string, Set<string>> = {
    'dairy': new Set([
        'shea butter', 'cocoa butter', 'cocoa seed butter', 'mango butter',
        'cupuacu butter', 'kokum butter', 'avocado butter', 'murumuru butter',
        'tucuma butter', 'illipe butter', 'sal butter', 'body butter',
        'hair butter', 'sunflower butter', 'coconut butter', 'almond butter',
        'peanut butter', 'cocoa mass', 'cacao butter',
        'coconut milk', 'oat milk', 'almond milk', 'soy milk', 'rice milk',
        'cashew milk', 'hemp milk',
    ]),
    'milk': new Set([
        'shea butter', 'cocoa butter', 'cocoa seed butter', 'mango butter',
        'cupuacu butter', 'kokum butter', 'avocado butter', 'murumuru butter',
        'tucuma butter', 'illipe butter', 'sal butter', 'body butter',
        'hair butter', 'sunflower butter', 'coconut butter', 'almond butter',
        'peanut butter', 'cocoa mass', 'cacao butter',
        'coconut milk', 'oat milk', 'almond milk', 'soy milk', 'rice milk',
        'cashew milk', 'hemp milk',
    ]),
    'sulfate': new Set([
        'sodium laureth sulfate', 'sodium lauryl sulfate', 'sles', 'sls',
        'ammonium lauryl sulfate', 'ammonium laureth sulfate',
        'sodium coco sulfate', 'sodium myreth sulfate', 'ferrous sulfate',
    ]),
    'sulfates': new Set([
        'sodium laureth sulfate', 'sodium lauryl sulfate', 'sles', 'sls',
        'ammonium lauryl sulfate', 'ammonium laureth sulfate',
        'sodium coco sulfate', 'sodium myreth sulfate', 'ferrous sulfate',
    ]),
    'gluten': new Set([
        'sodium benzoate', 'potassium sorbate', 'tocopherol', 'tocopheryl acetate',
        'citric acid', 'ascorbic acid', 'caramel color', 'caramel colour',
        // Fragrance chemicals — not gluten
        'hexyl cinnamal', 'benzyl benzoate', 'cinnamaldehyde', 'coumarin',
        'linalool', 'limonene', 'geraniol', 'citral', 'isoeugenol', 'eugenol',
        // Dye salts — chemistry naming, not dietary sulfate
        'phenylenediamine sulphate', 'phenylenediamine sulfate',
        'aminophenol sulfate', 'aminophenol sulphate',
    ]),
    // Dye/drug sulphate salts — NOT sulfate surfactant allergy
    'sulfate': new Set([
        ...Array.from(new Set([
            'sodium laureth sulfate', 'sodium lauryl sulfate', 'sles', 'sls',
            'ammonium lauryl sulfate', 'ammonium laureth sulfate',
            'sodium coco sulfate', 'sodium myreth sulfate', 'ferrous sulfate',
            // Dye salt forms whose name ends in sulphate/sulfate
            'phenylenediamine sulphate', 'phenylenediamine sulfate',
            'aminophenol sulfate', 'aminophenol sulphate',
            'resorcinol sulfate',
        ]))
    ]),
    'sulfates': new Set([
        ...Array.from(new Set([
            'sodium laureth sulfate', 'sodium lauryl sulfate', 'sles', 'sls',
            'ammonium lauryl sulfate', 'ammonium laureth sulfate',
            'sodium coco sulfate', 'sodium myreth sulfate', 'ferrous sulfate',
            'phenylenediamine sulphate', 'phenylenediamine sulfate',
            'aminophenol sulfate', 'aminophenol sulphate',
            'resorcinol sulfate',
        ]))
    ]),
}

function isAllergenExcluded(ingredientName: string, allergyName: string): boolean {
    const exclusions = ALLERGEN_EXCLUSIONS[allergyName]
    const lower = ingredientName.toLowerCase().trim()

    // Pattern-level exclusion: Sulphate/Sulfate as a dye/drug salt counter-ion
    // e.g. "N,N-Bis(2-Hydroxyethyl)-p-Phenylenediamine Sulphate" should NOT trigger sulfate allergy
    if (allergyName === 'sulfate' || allergyName === 'sulfates') {
        if (/phenylenediamine|aminophenol|diaminophenol|diaminophenoxyethanol|\bhcl\b|\bhci\b/i.test(lower) &&
            /sulph?ate/i.test(lower)) {
            return true
        }
    }

    if (!exclusions) return false
    for (const excl of exclusions) {
        if (lower.includes(excl) || excl.includes(lower)) return true
    }
    return false
}

// ══════════════════════════════════════════════════════
//  INGREDIENT RISK OVERRIDES — Hard-correct AI misclassifications
//  Applied BEFORE allergen elevation so user allergy always wins
// ══════════════════════════════════════════════════════

const INGREDIENT_RISK_OVERRIDES: Record<string, { riskLevel: 'high'|'moderate'|'low'|'negligible', note: string }> = {
    // ── Under-alarmed: AI marks negligible, reality is sensitizer ──
    'methylchloroisothiazolinone': { riskLevel: 'moderate', note: 'Known skin sensitizer — EU banned in leave-on cosmetics' },
    'mci': { riskLevel: 'moderate', note: 'Known skin sensitizer — EU banned in leave-on cosmetics' },
    'methylisothiazolinone': { riskLevel: 'moderate', note: 'Known skin sensitizer — EU banned in leave-on products' },
    'mi': { riskLevel: 'moderate', note: 'Known skin sensitizer — EU banned in leave-on products' },
    // ── Hair dye — strong allergen, AI often calls IARC Group 1 (wrong) ──
    'p-phenylenediamine': { riskLevel: 'moderate', note: 'Strong contact allergen in hair dyes — patch test required' },
    'ppd': { riskLevel: 'moderate', note: 'Strong contact allergen in hair dyes — patch test required' },
    'm-aminophenol': { riskLevel: 'low', note: 'Hair dye intermediate — sensitizer in some users' },
    // ── Over-alarmed: AI marks high, reality is low/mild ──
    'phenoxyethanol': { riskLevel: 'low', note: 'Mild preservative — irritation possible in sensitive users' },
    'linalool': { riskLevel: 'low', note: 'Fragrance allergen when oxidized — generally safe' },
    'limonene': { riskLevel: 'low', note: 'Fragrance allergen when oxidized — generally safe' },
    'coumarin': { riskLevel: 'low', note: 'Fragrance allergen requiring EU disclosure — not carcinogenic' },
    'citral': { riskLevel: 'low', note: 'Fragrance sensitizer in some users' },
    'steviol glycosides': { riskLevel: 'negligible', note: 'Approved sweetener — safe within ADI' },
    'steviol': { riskLevel: 'negligible', note: 'Approved sweetener — safe within ADI' },
    'stevia': { riskLevel: 'negligible', note: 'Approved sweetener — safe within ADI' },
    'e150d': { riskLevel: 'negligible', note: 'Approved caramel food colour' },
    // ── UV filters — permitted, endocrine debate unresolved ──
    'ethylhexyl methoxycinnamate': { riskLevel: 'low', note: 'Permitted UV filter — endocrine concern debated, not confirmed' },
    'octinoxate': { riskLevel: 'low', note: 'Permitted UV filter — endocrine concern debated, not confirmed' },
    'octocrylene': { riskLevel: 'low', note: 'UV filter — possible photoallergen in some users' },
    'benzophenone-4': { riskLevel: 'low', note: 'UV stabilizer — not an established endocrine disruptor' },
    'homosalate': { riskLevel: 'low', note: 'Permitted UV filter' },
    // ── Titanium dioxide — regulation depends on form, not a universal limit ──
    'titanium dioxide': { riskLevel: 'low', note: 'Permitted colorant — inhalation concern only in nano spray forms' },
    // ── Hair dye agents — IARC Group 3 does NOT mean hormone disruption ──
    'hexadimethrine chloride': { riskLevel: 'low', note: 'Hair care agent — no established endocrine disruption' },
    '2,4-diaminophenoxyethanol hcl': { riskLevel: 'low', note: 'Hair dye intermediate — no confirmed endocrine disruption' },
    '2,4-diaminophenoxyethanol hci': { riskLevel: 'low', note: 'Hair dye intermediate — no confirmed endocrine disruption' },
    // ── pH adjusters — permitted, overstated by AI ──
    'ethanolamine': { riskLevel: 'low', note: 'pH adjuster — permitted with concentration limits' },
    'ammonium hydroxide': { riskLevel: 'low', note: 'pH adjuster in hair products — permitted with use-condition limits' },
    'cyclopentasiloxane': { riskLevel: 'low', note: 'Silicone used for slip/spreadability. Not a common sensitizer.' },
    'c12-15 alkyl benzoate': { riskLevel: 'low', note: 'Low-risk emollient ester with excellent skin feel.' },
    'dimethicone': { riskLevel: 'low', note: 'Generally very well tolerated and often used for sensitive skin.' },
    'magnesium sulfate': { riskLevel: 'low', note: 'Magnesium sulfate is not equivalent to harsh surfactant sulfates like SLS.' },
    'tridecyl trimellitate': { riskLevel: 'low', note: 'Primarily emollient/film-former with low irritation profile.' },
    'polyglyceryl-3 diisostearate': { riskLevel: 'low', note: 'Mild emulsifier with low sensitization concern.' },
    'pentylene glycol': { riskLevel: 'low', note: 'Humectant/preservative-support ingredient, usually well tolerated.' },
    'bisabolol': { riskLevel: 'low', note: 'Soothing/anti-inflammatory, not commonly sensitizing.' },
    'hydroxyacetophenone': { riskLevel: 'low', note: 'Generally low-risk antioxidant/preservative-support ingredient.' },
    'ethoxydiglycol': { riskLevel: 'low', note: 'Solvent/penetration enhancer, generally low irritation risk.' },
    'quaternium-18 bentonite': { riskLevel: 'low', note: 'Clay-based thickening/suspending ingredient.' },
    'dimethiconol': { riskLevel: 'low', note: 'Silicone conditioning polymer with low sensitization concern.' },
    'dimethicone crosspolymer': { riskLevel: 'low', note: 'Texture-enhancing silicone elastomer, usually low-risk.' },
    'mica': { riskLevel: 'low', note: 'Mineral shimmer pigment; irritation uncommon.' },
    'triethoxycaprylylsilane': { riskLevel: 'low', note: 'Pigment-coating agent with low typical irritation concern.' },
    'polyester-1': { riskLevel: 'low', note: 'Film-former/color additive, low risk.' },
    'silica dimethyl silylate': { riskLevel: 'low', note: 'Thickening/texture-control ingredient.' },
    'pentaerythrityl tetra-di-t-butyl hydroxyhydrocinnamate': { riskLevel: 'low', note: 'Antioxidant stabilizer with low typical exposure risk.' },
    'peg-10': { riskLevel: 'low', note: 'PEGs are generally low-risk in cosmetics.' },
    'sorbitan sesquioleate': { riskLevel: 'low', note: 'Risk often overstated; general low allergy association.' },
    'peg-10 dimethicone': { riskLevel: 'low', note: 'Common silicone emulsifier with low irritation profile.' },
    'polyglyceryl-4 isostearate': { riskLevel: 'low', note: 'Emulsifier with low sensitization risk.' },
    'methicone': { riskLevel: 'low', note: 'Silicone coating agent with low irritation profile.' },
    '1,2-hexanediol': { riskLevel: 'low', note: 'Widely used humectant/preservative-support ingredient.' },
    'lauryl peg-10 dimethicone derivative': { riskLevel: 'low', note: 'Usually low-risk silicone emulsifier.' },
    'lauryl peg-10 dimethicone': { riskLevel: 'low', note: 'Usually low-risk silicone emulsifier.' },
    'parfum': { riskLevel: 'low', note: 'Fragrance sensitivity concern valid, but not an automatic hormone disruptor.' },
    'fragrance': { riskLevel: 'low', note: 'Fragrance sensitivity concern valid, but not an automatic hormone disruptor.' },
}

// High-severity allergen groups (food/anaphylaxis risk) vs cosmetic sensitizers
const HIGH_SEVERITY_ALLERGEN_GROUPS = new Set([
    'dairy', 'milk', 'egg', 'eggs', 'peanut', 'peanuts', 'tree nuts',
    'wheat', 'gluten', 'shellfish', 'fish', 'sesame', 'lupin',
])

// Apply risk overrides — MUST be called BEFORE allergen elevation
// so that allergen elevation can still raise the risk higher
function applyRiskOverrides(
    ingredients: any[],
    userProfile: { diseases: string[], allergies: string[], goals: string[] } | null
): void {
    const userAllergies = (userProfile?.allergies || [])
        .filter(a => a && a !== 'None')
        .map(a => a.toLowerCase().trim().replace(/-/g, ' '))

    for (const ing of ingredients) {
        const lower = (ing.name || '').toLowerCase().trim()
        const override = INGREDIENT_RISK_OVERRIDES[lower]
        if (!override) continue

        // Skip override if user is allergic to this ingredient
        // Allergen elevation will handle it correctly after this step
        const isUserAllergen = userAllergies.some(ua => {
            if (isAllergenExcluded(lower, ua)) return false
            const keywords = ALLERGEN_KEYWORD_MAP[ua] || [ua]
            return keywords.some(kw => {
                if (kw.length <= 4) return new RegExp(`\\b${kw}\\b`, 'i').test(lower)
                return lower.includes(kw)
            })
        })
        if (isUserAllergen) continue  // Allergen elevation takes full priority

        ing.riskLevel = override.riskLevel
        // Only write override note if AI note is absent or just a generic placeholder
        if (!ing.personalNote || ing.personalNote.toLowerCase().includes('review before use')) {
            ing.personalNote = override.note
        }
    }
}

// ══════════════════════════════════════════════════════
//  REGULATORY STATUS FILTER — Blocks AI hallucinations
// ══════════════════════════════════════════════════════

const REJECT_REGULATORY_PATTERNS = [
    /\d+\s*CFR\s*\d+/i,
    /<\s*\d+(\.\d+)?\s*%/i,
    /EWG\s*\d+/i,
    /restricted.*\d+(\.\d+)?\s*%/i,
]

const ALLOW_REGULATORY_PATTERNS = [
    /^IARC Group [12][AB]?/i,
    /^(EU|FDA|EPA|Health Canada)\s+(banned|restricted|prohibited|not permitted)/i,
    /^Banned/i,
    /^GRAS/i,
    /^Not permitted/i,
]

function filterRegulatoryStatus(ingredientName: string, aiStatus: string | null, productType: string): string | null {
    const lower = ingredientName.toLowerCase().trim()
    if (lower in REGULATORY_DICT) {
        const entry = REGULATORY_DICT[lower]
        if (entry === null) return null
        if (entry.context === 'both' || entry.context === productType) return entry.status
        return null
    }
    if (!aiStatus) return null
    for (const pattern of REJECT_REGULATORY_PATTERNS) {
        if (pattern.test(aiStatus)) {
            console.warn(`🚫 Rejected hallucinated regulatory: "${aiStatus}" for ${ingredientName}`)
            return null
        }
    }
    if (!ALLOW_REGULATORY_PATTERNS.some(p => p.test(aiStatus.trim()))) return null
    return aiStatus
}

// ══════════════════════════════════════════════════════
//  SCORING ENGINE — Personalized 3-Layer Grading
//
//  Layer 1: Base toxicity from ingredient risk levels
//  Layer 2: Personalization penalties/bonuses from health profile
//  Layer 3: Grade thresholds (unchanged A-E scale)
//
//  Design: Neutral and accurate. Not fearmongering.
//  - Single allergen trigger on safe product → B, not D/E
//  - D only for MULTIPLE compounding concerns
//  - E only for genuinely dangerous + profile conflicts
//  - Beneficial ingredients actively LOWER the score
// ══════════════════════════════════════════════════════

type RiskLevel = 'high' | 'moderate' | 'low' | 'negligible'

const BASE_RISK_WEIGHTS: Record<string, number> = {
    'high': 80, 'moderate': 35, 'low': 10, 'negligible': 2,
}

function getPositionWeightedScore(riskLevel: string, position: number, total: number): number {
    const base = BASE_RISK_WEIGHTS[riskLevel] ?? 15
    if (total <= 0) return base
    const ratio = position / total
    if (ratio <= 0.2) return base
    if (ratio <= 0.5) return base * 0.7
    return base * 0.3
}

function computeToxicityScore(ingredients: any[], nova: number | null = null, additivesCount: number = 0, userProfile: any = null): number {
    if (!ingredients || ingredients.length === 0) return 50

    // ── Layer 1: Base toxicity from ingredient risk levels ──
    const totalWeight = ingredients.reduce((sum: number, ing: any, index: number) => {
        return sum + getPositionWeightedScore(ing.riskLevel || 'low', index + 1, ingredients.length)
    }, 0)
    let score = totalWeight / ingredients.length

    // ── Risk Floor: dangerous top-5 ingredients cannot be diluted to A ──
    const top5 = ingredients.slice(0, Math.min(5, ingredients.length))
    const hasTop5High = top5.some((ing: any) => ing.riskLevel === 'high')
    const hasTop5Moderate = top5.some((ing: any) => ing.riskLevel === 'moderate')

    if (nova === 4) score += 8; else if (nova === 3) score += 4
    score += Math.min(additivesCount * 2, 10)

    // Apply risk floor AFTER base calculation
    if (hasTop5High) score = Math.max(score, 55)
    if (hasTop5Moderate && !hasTop5High) score = Math.max(score, 30)

    // ── Layer 2: Personalization penalties/bonuses ──
    if (userProfile) {
        const d = (userProfile.diseases || []).filter((x: string) => x !== 'None')
        const a = (userProfile.allergies || []).filter((x: string) => x !== 'None')
        const g = (userProfile.goals || []).filter(Boolean)
        const hasProfile = d.length > 0 || a.length > 0 || g.length > 0

        if (hasProfile) {
            let allergenCount = 0
            let diseaseCount = 0
            let goalConflictCount = 0
            let beneficialCount = 0

            for (const ing of ingredients) {
                const note = ing.personalNote || ''
                const lower = note.toLowerCase()
                const ingName = (ing.name || '').toLowerCase()

                // Allergen penalties ONLY apply if the user has declared allergies
                if (a.length > 0) {
                    // Name-based allergen match (catches custom allergies even if AI note is generic)
                    const nameMatchesAllergy = a.some((allergy: string) => ingName.includes(allergy.toLowerCase()))
                    if (nameMatchesAllergy) {
                        allergenCount++
                        continue
                    }

                    // Allergen triggers (🚨 prefix from server-side elevation)
                    if (lower.startsWith('🚨')) {
                        allergenCount++
                        continue
                    }
                }

                if (!note) continue

                // Beneficial ingredients (✅ prefix)
                if (lower.startsWith('✅')) {
                    beneficialCount++
                    continue
                }

                // Disease-harmful (mentions a user condition + harmful signal words)
                const isDiseaseHarmful = d.some((disease: string) => lower.includes(disease.toLowerCase())) &&
                    ['worsen', 'spike', 'disrupt', 'inflam', 'damage', 'strain', 'aggravat', 'bad for', 'harmful', 'raises', 'triggers', 'weakens'].some(s => lower.includes(s))
                if (isDiseaseHarmful) {
                    diseaseCount++
                    continue
                }

                // Goal conflicts
                const isGoalConflict = g.some((goal: string) => lower.includes(goal.toLowerCase())) &&
                    ['conflict', 'counter', 'undermine', 'hinder', 'bad for', 'against'].some(s => lower.includes(s))
                if (isGoalConflict) {
                    goalConflictCount++
                }
            }

            // Apply penalties (graduated, not fearmongering)
            // First allergen hit is the strongest signal (+18), subsequent are +12
            if (allergenCount > 0) {
                score += 18 + Math.min((allergenCount - 1) * 12, 24)
            }
            // Disease conflicts: +12 each, capped at +36
            score += Math.min(diseaseCount * 12, 36)
            // Goal conflicts: +8 each, capped at +24
            score += Math.min(goalConflictCount * 8, 24)
            // Beneficial ingredients reward: -3 each, capped at -15
            score -= Math.min(beneficialCount * 3, 15)
        }
    }

    return Math.min(Math.max(Math.round(score), 0), 100)
}

function computeGrade(score: number, hasUserAllergen: boolean = false): string {
    if (hasUserAllergen && score <= 55) return 'D'
    if (score <= 15) return 'A'; if (score <= 35) return 'B'
    if (score <= 55) return 'C'; if (score <= 75) return 'D'; return 'E'
}

// ══════════════════════════════════════════════════════
//  USER HEALTH PROFILE
// ══════════════════════════════════════════════════════

async function fetchUserHealthProfile(supabase: any, userId: string) {
    try {
        const { data, error } = await supabase.from('users').select('health_preferences').eq('id', userId).single()
        if (error || !data?.health_preferences) return null
        const p = data.health_preferences
        return { diseases: p.diseases || [], allergies: p.allergies || [], goals: p.goals || [] }
    } catch { return null }
}

// ══════════════════════════════════════════════════════
//  THE PERSONALIZATION ENGINE — Complete Rewrite
//
//  Problems with old prompt:
//  1. "max 8 words" → AI writes "Contains sugar" (useless)
//  2. No examples of GOOD vs BAD notes
//  3. No instruction to mention WHY something is bad
//  4. No instruction to highlight BENEFITS
//  5. No structure for what a note should contain
//
//  Fix: Explicit note templates + mandatory components
// ══════════════════════════════════════════════════════

function buildUserBlock(profile: { diseases: string[], allergies: string[], goals: string[] } | null): string {
    if (!profile) return ''
    const d = profile.diseases.filter(x => x !== 'None')
    const a = profile.allergies.filter(x => x !== 'None')
    const g = profile.goals?.filter(Boolean) || []
    if (!d.length && !a.length && !g.length) return ''

    let block = `\n══ PATIENT PROFILE ══\n`
    if (a.length) block += `ALLERGIES: [${a.join(', ')}]\n`
    if (d.length) block += `CONDITIONS: [${d.join(', ')}]\n`
    if (g.length) block += `GOALS: [${g.join(', ')}]\n`

    block += `
══ personalNote PROTOCOL ══
EVERY ingredient gets a note. No nulls. Write like a nutritionist dashboard.
For dietary triggers (sugar/carbs/fats/salt all macros): If amounts are HIGH, flag as moderate/high and state metabolic impact.
- high/moderate: 5-8 words max. Body effect and function + short regulatory limit (e.g. "ADA recommends <25g/day" or correct dosage).
- Allergy match: Start with 🚨.
- Beneficial for condition/goal: Start with ✅.
- low/negligible: 2-3 words. What it does in the body.
NO apostrophes. NO quotes inside notes. NO markdown. NO generic filler. NO nulls.
`

    return block
}

// ══════════════════════════════════════════════════════
//  TOKEN ESTIMATOR — Dynamic allocation per ingredient count
//  ~105 tokens per ingredient (name + riskLevel + category +
//  personalNote 2-5 words on ALL + regulatoryStatus + JSON syntax)
//  + 350 base for summary/schema overhead
//  Capped at 4000 to stay safely under Groq free-tier TPM limits
// ══════════════════════════════════════════════════════

function estimateMaxTokens(count: number, userProfile: any, isTier2: boolean = false): number {
    if (isTier2) return Math.min(count * 75 + 250, 2500)
    const perIng = userProfile ? 115 : 95
    return Math.min(count * perIng + 350, 4000)
}

// ══════════════════════════════════════════════════════
//  INGREDIENT NORMALIZATION (unchanged — battle-tested)
// ══════════════════════════════════════════════════════

function findSplitPosition(items: string[], isCosmetic: boolean): number {
    const markers = isCosmetic ? COSMETIC_MARKERS : FOOD_MARKERS
    for (let i = 0; i < items.length; i++) {
        let clean = items[i].toLowerCase().replace(/[.*]$/g, '').trim()
        clean = clean.replace(/\([^)]*\)/g, '').replace(/$$[^$$]*\]/g, '').trim()
        if (markers.has(clean)) return i
        if (clean.startsWith('spices') || clean.startsWith('fragrance') || clean.startsWith('parfum')) return i
    }
    return Math.ceil(items.length * 0.6)
}

function containsPoison(items: string[]): boolean {
    return items.some(item => {
        if (!item) return false
        const lower = item.toLowerCase().trim()
        for (const p of POISON_OVERRIDE) { if (lower.includes(p)) return true }
        return false
    })
}

function normalizeIngredientText(raw: string, productType: string): string {
    let text = raw.trim()
    text = text.replace(/^[A-Z0-9]+\s+\d+\s+INGREDIENTS?\s*/i, '')
    text = text.replace(/\bF\.?I\.?L\.?\s*[A-Z]?\d*[\/\d]*/gi, '')
    text = text.replace(/\b[A-Z]\d{5,}[\/\d]*\b/g, '')

    let mayContainText = ''
    const mcMatch = text.match(/$$\+?\/?-?\s*(?:MAY CONTAIN|PEUT CONTENIR)\s*[\/:]?\s*([\s\S]*?)$$/i)
    if (mcMatch) { mayContainText = mcMatch[1]; text = text.replace(mcMatch[0], '') }

    const multilingualPairs = [
        /CERA MICROCRISTALLINA\s*\/\s*MICROCRYSTALLINE WAX\s*(?:\/\s*CIRE MICROCRISTALLINE)?/gi,
        /CERA ALBA\s*\/\s*BEESWAX\s*(?:\/\s*CIRE D'?ABEILLE)?/gi,
        /SESAMUM INDICUM OIL\s*\/\s*SESAME SEED OIL/gi,
        /SESAMUM INDICUM\s*\/\s*SESAME SEED/gi,
        /MEL\s*\/\s*HONEY\s*(?:\/\s*MIEL)?/gi,
        /PARFUM\s*\/\s*FRAGRANCE/gi,
        /FRAGRANCE\s*\/\s*PARFUM/gi,
        /LANOLIN LIQUIDA\s*\/\s*LANOLIN OIL/gi,
        /AQUA\s*\/\s*WATER\s*(?:\/\s*EAU)?/gi,
        /SODIUM CHLORIDE\s*\/\s*SALT\s*(?:\/\s*SEL)?/gi,
        /TOCOPHEROL\s*\/\s*VITAMIN E/gi,
    ]
    for (const pattern of multilingualPairs) {
        text = text.replace(pattern, (match) => match.split(/\s*\/\s*/)[0].trim())
    }

    text = text.replace(/CI\s+(\d+)\s*\/\s*([A-Z][A-Z\s]+?)(?=\s*(?:CI|,|$$|$))/gi, 'CI $1')
    text = text.replace(/\s+\/\s+/g, ', ')
    text = text.replace(/\s*[•·]\s*/g, ', ')
    text = text.replace(/\s*;\s*/g, ', ')

    if (mayContainText) {
        let mc = mayContainText
        mc = mc.replace(/\s+\/\s+/g, ', ')
        mc = mc.replace(/CI\s+(\d+)\s*\/\s*([A-Z][A-Z\s]+?)(?=\s*(?:CI|,|\[|$))/gi, 'CI $1')
        text = text.replace(/,?\s*$/, '') + ', ' + mc.trim()
    }

    text = text.replace(/\s{2,}/g, ' ').replace(/,\s*,+/g, ',')
    text = text.replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '')
    return text.trim()
}

function splitIngredients(normalizedText: string): string[] {
    return normalizedText.split(/\s*,\s*/).map(s => s.trim()).filter(s => {
        if (!s || s.length < 2) return false
        if (/^\d+$/.test(s)) return false
        if (/^(MAY CONTAIN|PEUT CONTENIR|KANN ENTHALTEN)$/i.test(s)) return false
        if (/^[+\-\/]+$/.test(s)) return false
        return true
    })
}

// ══════════════════════════════════════════════════════
//  BODY FUNCTION NOTES — Server-side notes for safe ingredients
//  that bypass AI analysis (skipped/backfilled items)
// ══════════════════════════════════════════════════════

const BODY_FUNCTION_MAP: Record<string, string> = {
    'water': 'Hydration base', 'aqua': 'Hydration base',
    'salt': 'Electrolyte balance', 'sodium chloride': 'Electrolyte balance',
    'sugar': 'Energy source', 'sucrose': 'Energy source', 'glucose': 'Energy source', 'fructose': 'Energy source',
    'citric acid': 'Acidity regulator', 'lactic acid': 'Acidity regulator', 'malic acid': 'Acidity regulator',
    'ascorbic acid': 'Antioxidant vitamin C', 'vitamin c': 'Antioxidant vitamin C',
    'tocopherol': 'Antioxidant vitamin E', 'vitamin e': 'Antioxidant vitamin E',
    'iron': 'Blood oxygen carrier', 'calcium': 'Bone strength support',
    'potassium': 'Nerve and muscle function', 'magnesium': 'Muscle and nerve support',
    'zinc': 'Immune system support', 'fiber': 'Digestive health support', 'fibre': 'Digestive health support',
    'glycerin': 'Moisture retention', 'glycerine': 'Moisture retention', 'glycerol': 'Moisture retention',
    'soy lecithin': 'Emulsifier - texture agent', 'lecithin': 'Emulsifier - texture agent',
    'pectin': 'Gelling - texture agent', 'gelatin': 'Gelling - texture agent',
    'corn starch': 'Thickening agent', 'starch': 'Thickening agent', 'modified starch': 'Thickening agent',
    'baking soda': 'Leavening agent', 'sodium bicarbonate': 'Leavening agent',
    'yeast': 'Fermentation agent', 'vinegar': 'Acidifier - preservative',
    'olive oil': 'Healthy fat source', 'sunflower oil': 'Cooking oil base', 'palm oil': 'Fat source',
    'coconut oil': 'Fat source', 'butter': 'Saturated fat source', 'cocoa butter': 'Fat and texture',
    'milk': 'Calcium and protein', 'cream': 'Fat and texture',
    'wheat flour': 'Carbohydrate base', 'flour': 'Carbohydrate base', 'rice flour': 'Carbohydrate base',
    'egg': 'Protein and binding', 'whole egg': 'Protein and binding',
    'natural flavor': 'Flavor enhancer', 'natural flavors': 'Flavor enhancer', 'natural flavour': 'Flavor enhancer',
    'vanilla': 'Flavor enhancer', 'vanilla extract': 'Flavor enhancer', 'spices': 'Flavor and aroma',
    'caramel color': 'Color additive', 'caramel colour': 'Color additive',
    'xanthan gum': 'Stabilizer - thickener', 'guar gum': 'Stabilizer - thickener',
    'cellulose': 'Dietary fiber source', 'inulin': 'Prebiotic fiber',
    'niacinamide': 'Skin barrier support', 'hyaluronic acid': 'Deep hydration',
    'retinol': 'Cell renewal support', 'salicylic acid': 'Exfoliant - pore cleanser',
    'aloe vera': 'Soothing and healing', 'aloe barbadensis': 'Soothing and healing',
    'shea butter': 'Deep moisturizer',
    'lavender oil': 'Fragrance and essential oil', 'lavender': 'Fragrance and essential oil',
    'lavandula angustifolia': 'Fragrance and essential oil',
    'tea tree oil': 'Antimicrobial — may irritate sensitive skin',
    'melaleuca alternifolia': 'Antimicrobial — may irritate sensitive skin',
    'oryza sativa bran oil': 'Emollient plant oil', 'rice bran oil': 'Emollient plant oil',
    'oryza sativa': 'Emollient plant oil',
    'piroctone olamine': 'Anti-dandruff antifungal active',
    'methylchloroisothiazolinone': 'Preservative — known skin sensitizer',
    'methylisothiazolinone': 'Preservative — known skin sensitizer',
    'cocamide mea': 'Foam booster — mild irritation possible',
    'alcohol denat.': 'Cosmetic solvent', 'denatured alcohol': 'Cosmetic solvent',
    'sd alcohol': 'Cosmetic solvent',
    'sulfur': 'Anti-acne antifungal active',
    'sodium benzoate': 'Preservative',
    'piroctone olamine': 'Anti-dandruff antifungal active',
    'dimethicone': 'Skin smoothing agent', 'cetyl alcohol': 'Emollient - softener',
    'panthenol': 'Moisture and healing', 'allantoin': 'Skin soothing agent',
    'bis-ethylhexyloxyphenol methoxyphenyl triazine': 'Safe, photostable UV filter',
    'bemotrizinol': 'Safe, photostable UV filter', 'tinosorb s': 'Safe, photostable UV filter',
    'maltodextrin': 'Carbohydrate filler', 'dextrose': 'Simple sugar energy',
    'tapioca starch': 'Thickening agent', 'potato starch': 'Thickening agent',
    'oats': 'Whole grain fiber', 'oat flour': 'Carbohydrate base', 'barley': 'Whole grain',
    'semolina': 'Wheat carbohydrate', 'rice': 'Carbohydrate base',
    'canola oil': 'Cooking oil base', 'rapeseed oil': 'Cooking oil base',
    'safflower oil': 'Cooking oil base', 'sesame oil': 'Cooking oil',
    'gelatin': 'Gelling - texture agent', 'gelatine': 'Gelling - texture agent',
    'annatto': 'Natural color', 'turmeric': 'Natural color and spice',
    'polysorbate 20': 'Emulsifier', 'polysorbate 60': 'Emulsifier', 'polysorbate 80': 'Emulsifier',
    'jojoba oil': 'Skin moisturizer', 'argan oil': 'Skin moisturizer',
    'beeswax': 'Natural sealant', 'cera alba': 'Natural sealant', 'lanolin': 'Skin conditioner',
    'lactic acid': 'Acidity regulator', 'acetic acid': 'Acidifier - preservative',
    'gentiana scabra extract': 'Botanical skin-conditioning extract',
    'opuntia streptacantha stem extract': 'Botanical skin-conditioning/hydrating extract',
    'sophora flavescens root extract': 'Botanical skincare extract',
    'ophiopogon japonicus root extract': 'Botanical skincare extract',
    'sorbitol': 'Humectant/moisturizer',
    'trehalose': 'Humectant/moisture-protective sugar',
    'ethylhexyl palmitate': 'Cosmetic functional agent',
    'caprylic/capric triglyceride': 'Lightweight emollient',
    'sodium hyaluronate': 'Hydrates skin',
    'silica': 'Texture/absorbent ingredient',
    'stearic acid': 'Fatty acid/emulsifier/thickener',
    'magnesium stearate': 'Texture/binding agent',
}

function getBodyFunction(name: string, isCosmetic: boolean): string {
    const lower = name.toLowerCase().replace(/[.*]$/g, '').trim()
    // Direct lookup
    if (BODY_FUNCTION_MAP[lower]) return BODY_FUNCTION_MAP[lower]
    // Partial match — check if any key is contained in the name
    for (const [key, note] of Object.entries(BODY_FUNCTION_MAP)) {
        if (key.length > 3 && lower.includes(key)) return note
    }
    // Pattern-based fallback
    if (/vitamin/i.test(lower)) return 'Nutrient support'
    if (/oil|butter/i.test(lower)) return isCosmetic ? 'Moisture source' : 'Fat source'
    if (/acid/i.test(lower)) return isCosmetic ? 'pH regulator' : 'Acidity regulator'
    if (/gum|cellulose/i.test(lower)) return 'Stabilizer - thickener'
    if (/flavor|flavour|aroma|extract/i.test(lower)) return 'Flavor or aroma'
    if (/color|colour|ci \d/i.test(lower)) return 'Color additive'
    if (/protein|casein|whey/i.test(lower)) return 'Protein source'
    if (/starch|flour|grain|wheat|rice|corn|oat/i.test(lower)) return 'Carbohydrate source'
    // Generic fallback
    return isCosmetic ? 'Cosmetic functional agent' : 'Food functional ingredient'
}

// ══════════════════════════════════════════════════════
//  COMPLETENESS GUARD
// ══════════════════════════════════════════════════════

function ensureCompleteness(aiIngredients: any[], rawText: string, productType: string): any[] {
    const rawItems = rawText.split(/,\s*/).map(s => s.trim()).filter(Boolean)
    if (aiIngredients.length >= rawItems.length) return aiIngredients

    console.warn(`⚠️ Completeness: AI ${aiIngredients.length}/${rawItems.length}. Backfilling...`)
    const aiNameSet = new Set(aiIngredients.map(ing => ing.name?.toLowerCase().trim()))
    const isCosmetic = productType === 'cosmetic'
    const splitPos = findSplitPosition(rawItems, isCosmetic)
    const complete = [...aiIngredients]

    for (let i = 0; i < rawItems.length; i++) {
        const name = rawItems[i].trim()
        const lower = name.toLowerCase()
        if (aiNameSet.has(lower)) continue
        let found = false
        for (const aiName of aiNameSet) {
            if (aiName.length > 3 && lower.length > 3 && (aiName.includes(lower) || lower.includes(aiName))) { found = true; break }
        }
        if (found) continue

        const isTrace = i >= splitPos
        const isPoisonous = containsPoison([name])
        const cleanName = lower.replace(/[.*]$/g, '').trim()
        const isSafeMarker = isCosmetic ? SAFE_COSMETIC_MARKERS.has(cleanName) : SAFE_FOOD_MARKERS.has(cleanName)

        complete.push({
            name, position: i + 1,
            category: null,
            riskLevel: isPoisonous ? 'high' : (isSafeMarker ? 'negligible' : (isTrace ? 'negligible' : 'low')) as RiskLevel,
            personalNote: getBodyFunction(name, isCosmetic), regulatoryStatus: null,
        })
    }

    complete.sort((a, b) => (a.position || 999) - (b.position || 999))
    console.log(`✅ Backfilled: ${aiIngredients.length} → ${complete.length}`)
    return complete
}

// ══════════════════════════════════════════════════════
//  HEALTH SCORES — Smart categorization from AI notes
// ══════════════════════════════════════════════════════

function computeHealthScores(ingredients: any[], userProfile: any): any[] {
    if (!userProfile) return []
    const scores: any[] = []
    const d = (userProfile.diseases || []).filter((x: string) => x !== 'None')
    const a = (userProfile.allergies || []).filter((x: string) => x !== 'None')
    const g = (userProfile.goals || []).filter(Boolean)
    const total = ingredients.length || 1
    const highCount = ingredients.filter((i: any) => i.riskLevel === 'high').length
    const modCount = ingredients.filter((i: any) => i.riskLevel === 'moderate').length

    // Categorize each ingredient by checking both name and personalNote
    const categorizeNote = (ing: any): 'allergy' | 'disease' | 'goal' | 'benefit' | 'general' => {
        const note = (ing.personalNote || '').toLowerCase()
        const name = (ing.name || '').toLowerCase()

        // Explicit iteration over allergies to match ingredient name or note
        for (const allergy of a) {
            const allergyLower = allergy.toLowerCase()
            if (name.includes(allergyLower) || note.includes(allergyLower)) return 'allergy'
        }

        if (note.startsWith('🚨') || note.includes('allergen') || note.includes('allerg') || note.includes('trigger')) return 'allergy'
        if (note.startsWith('✅')) return 'benefit'
        // Check against actual user conditions
        for (const disease of d) { if (note.includes(disease.toLowerCase())) return 'disease' }
        for (const goal of g) { if (note.includes(goal.toLowerCase())) return 'goal' }
        // Signal word fallback
        if (['worsen', 'spike', 'disrupt', 'inflam', 'damage', 'strain', 'aggravat'].some(s => note.includes(s))) return 'disease'
        if (['conflict', 'counter', 'undermine', 'hinder'].some(s => note.includes(s))) return 'goal'
        return 'general'
    }

    const noted = ingredients.filter((i: any) => i.personalNote || i.name)
    const categorized = noted.map((i: any) => ({ ...i, noteType: categorizeNote(i) }))
    const benefits = categorized.filter(i => i.noteType === 'benefit')

    if (a.length) {
        const rel = categorized.filter(i => i.noteType === 'allergy')
        const score = rel.length === 0
            ? Math.max(70, 100 - highCount * 10)
            : Math.max(0, Math.round(100 - (rel.length * 40) - highCount * 15))
        scores.push({
            category: 'allergies',
            score: Math.min(100, Math.max(0, score)),
            note: rel.length === 0
                ? 'No allergen triggers found for your profile'
                : `${rel.length} allergen trigger${rel.length > 1 ? 's' : ''} detected — check flagged items`,
            concerns: rel.map((i: any) => ({ item: i.name, note: i.personalNote })),
        })
    }

    if (d.length) {
        const harmful = categorized.filter(i => i.noteType === 'disease')
        const helpful = benefits.filter(i => {
            const lower = i.personalNote.toLowerCase()
            return d.some((disease: string) => lower.includes(disease.toLowerCase()))
        })
        const score = Math.max(0, Math.min(100, Math.round(
            100 - (harmful.length / total * 180) + (helpful.length * 5) - highCount * 12 - modCount * 4
        )))
        scores.push({
            category: 'conditions', score,
            note: harmful.length === 0 && helpful.length > 0
                ? `${helpful.length} beneficial ingredient${helpful.length > 1 ? 's' : ''} for your conditions`
                : harmful.length === 0
                    ? (highCount > 0 ? 'No direct links but toxic ingredients present' : 'No harmful interactions with your conditions')
                    : `${harmful.length} concern${harmful.length > 1 ? 's' : ''} for your conditions${helpful.length > 0 ? `, ${helpful.length} beneficial` : ''}`,
            concerns: harmful.map((i: any) => ({ item: i.name, note: i.personalNote })),
        })
    }

    if (g.length) {
        const conflicts = categorized.filter(i => i.noteType === 'goal')
        const helpful = benefits.filter(i => {
            const lower = i.personalNote.toLowerCase()
            return g.some((goal: string) => lower.includes(goal.toLowerCase()))
        })
        const safeRatio = ingredients.filter((i: any) =>
            i.riskLevel === 'negligible' || i.riskLevel === 'low'
        ).length / total
        const score = Math.max(0, Math.min(100, Math.round(
            safeRatio * 70 + 30 + (helpful.length * 5) - conflicts.length * 12 - highCount * 8 - modCount * 3
        )))
        scores.push({
            category: 'goals', score,
            note: conflicts.length > 0
                ? `${conflicts.length} ingredient${conflicts.length > 1 ? 's' : ''} conflict with goals${helpful.length > 0 ? `, but ${helpful.length} support them` : ''}`
                : helpful.length > 0
                    ? `${helpful.length} ingredient${helpful.length > 1 ? 's' : ''} actively support your goals`
                    : (score >= 60 ? 'Generally aligned with your health goals' : 'Low overall safety may undermine your goals'),
            concerns: conflicts.map((i: any) => ({ item: i.name, note: i.personalNote })),
        })
    }

    return scores
}

// ══════════════════════════════════════════════════════
//  ALLERGEN ELEVATION — Server-side safety net for barcode scans
//  Cross-references ingredient names with user's allergy profile
//  using a Deep Alias Dictionary. Elevates matching ingredients
//  to 'moderate' risk and writes explicit 🚨 warnings.
// ══════════════════════════════════════════════════════

const ALLERGEN_KEYWORD_MAP: Record<string, string[]> = {
    'dairy': ['milk', 'cream', 'butter', 'cheese', 'whey', 'casein', 'lactose', 'yogurt', 'ghee', 'lactalbumin', 'lactoferrin'],
    'milk': ['milk', 'cream', 'butter', 'cheese', 'whey', 'casein', 'lactose', 'yogurt', 'ghee', 'lactalbumin', 'lactoferrin'],
    'egg': ['egg', 'albumin', 'lysozyme', 'mayonnaise', 'meringue', 'ovalbumin', 'ovomucin'],
    'eggs': ['egg', 'albumin', 'lysozyme', 'mayonnaise', 'meringue', 'ovalbumin', 'ovomucin'],
    'peanut': ['peanut', 'arachis', 'groundnut'],
    'peanuts': ['peanut', 'arachis', 'groundnut'],
    'tree nuts': ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'macadamia', 'hazelnut', 'brazil nut', 'chestnut', 'pine nut'],
    'wheat': ['wheat', 'flour', 'gluten', 'semolina', 'durum', 'spelt', 'kamut', 'farro', 'bulgur', 'couscous'],
    'gluten': ['wheat', 'flour', 'gluten', 'barley', 'rye', 'oat', 'spelt', 'semolina', 'malt'],
    'soy': ['soy', 'soja', 'soya', 'lecithin', 'tofu', 'edamame', 'miso', 'tempeh'],
    'fish': ['fish', 'anchovy', 'cod', 'salmon', 'tuna', 'sardine', 'mackerel', 'herring', 'tilapia'],
    'shellfish': ['shrimp', 'crab', 'lobster', 'prawn', 'crawfish', 'crayfish', 'shellfish', 'mussel', 'clam', 'oyster', 'scallop'],
    'sesame': ['sesame', 'tahini', 'halvah'],
    'sulfite': ['sulfite', 'sulphite', 'sulfur dioxide', 'sulphur dioxide', 'metabisulfite', 'sodium sulfite'],
    'sulfites': ['sulfite', 'sulphite', 'sulfur dioxide', 'sulphur dioxide', 'metabisulfite', 'sodium sulfite'],
    'mustard': ['mustard'],
    'celery': ['celery', 'celeriac'],
    'lupin': ['lupin', 'lupine'],
    'corn': ['corn', 'maize', 'cornstarch', 'corn syrup', 'dextrose', 'maltodextrin'],
    // Cosmetic / chemical sensitivities
    'sulfate': ['magnesium sulfate', 'zinc sulfate', 'copper sulfate', 'sodium sulfate', 'iron sulfate', 'barium sulfate'],
    'sulfates': ['magnesium sulfate', 'zinc sulfate', 'copper sulfate', 'sodium sulfate', 'iron sulfate', 'barium sulfate'],
    'paraben': ['paraben', 'methylparaben', 'propylparaben', 'butylparaben', 'ethylparaben', 'isobutylparaben'],
    'parabens': ['paraben', 'methylparaben', 'propylparaben', 'butylparaben', 'ethylparaben', 'isobutylparaben'],
    'fragrance': ['fragrance', 'parfum', 'perfume', 'aroma'],
    'latex': ['latex', 'natural rubber'],
    'nickel': ['nickel'],
    'formaldehyde': ['formaldehyde', 'formalin', 'quaternium-15', 'dmdm hydantoin', 'imidazolidinyl urea', 'diazolidinyl urea'],
}

function elevateAllergenIngredients(
    ingredients: any[],
    userProfile: { diseases: string[], allergies: string[], goals: string[] } | null
): string[] {
    const matched: string[] = []
    if (!userProfile) return matched
    const userAllergies = (userProfile.allergies || [])
        .filter(a => a && a !== 'None')
        .map(a => a.toLowerCase().trim().replace(/-/g, ' '))
    if (userAllergies.length === 0) return matched

    for (const ing of ingredients) {
        const name = (ing.name || '').toLowerCase()
        const existingNote = (ing.personalNote || '').toLowerCase()
        const matchedAllergy = userAllergies.find(ua => {
            // Skip if this ingredient is in the exclusion list for this allergy
            if (isAllergenExcluded(name, ua)) return false
            const keywords = ALLERGEN_KEYWORD_MAP[ua] || [ua]
            return keywords.some(kw => {
                // Whole-word match for short keywords to prevent substring false positives
                if (kw.length <= 4) {
                    return new RegExp(`\\b${kw}\\b`, 'i').test(name)
                }
                return name.includes(kw)
            })
        })

        if (matchedAllergy) {
            matched.push(matchedAllergy)
            // Elevate to 'high' so it strongly impacts base toxicity score
            ing.riskLevel = 'high'
            ing.category = 'allergen'

            // Write calibrated allergen warning
            if (!existingNote.includes('severe risk') && !existingNote.includes('allergic reaction') && !existingNote.includes('caution')) {
                const allergenName = matchedAllergy.charAt(0).toUpperCase() + matchedAllergy.slice(1)
                const ingName = ing.name || 'this ingredient'
                if (HIGH_SEVERITY_ALLERGEN_GROUPS.has(matchedAllergy)) {
                    ing.personalNote = `🚨 SEVERE RISK: Contains ${allergenName}. May trigger your ${matchedAllergy} allergy — avoid this product.`
                } else {
                    // Cosmetic sensitizers: correct framing is skin contact, NOT consumption
                    ing.personalNote = `⚠️ CAUTION: Contains ${allergenName} — may cause skin sensitization in some users.`
                }
            }
        }
    }
    return Array.from(new Set(matched))
}

// ══════════════════════════════════════════════════════
//  THE PROMPT — Precision-engineered for rich personalNotes
// ══════════════════════════════════════════════════════

function buildBarcodeScanPrompt(ingredientsList: string, productType: string, productName: string, userProfile: any, expectedCount: number, nutrientLevels: any = {}, macros: any = {}): string {
    const hasProfile = userProfile && (
        userProfile.diseases?.some((d: string) => d !== 'None') ||
        userProfile.allergies?.some((a: string) => a !== 'None') ||
        userProfile.goals?.length
    )

    let nutritionContext = ''
    if (productType === 'food') {
        const levels = Object.entries(nutrientLevels || {}).filter(([_, v]) => v === 'high' || v === 'moderate').map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(', ')
        const macrosText = Object.entries(macros || {}).filter(([k, v]) => ['sugar', 'salt', 'fats', 'saturatedFat', 'carbs'].includes(k) && Number(v) > 0).map(([k, v]) => `${k.toUpperCase()}: ${v}g`).join(', ')
        if (levels || macrosText) {
            nutritionContext = `\nNUTRITIONAL STATS: ${levels ? '[' + levels + '] ' : ''}${macrosText}`
        }
    }

    return `You are a personal doctor, nutritionist, and psychologist. Output ONLY valid JSON. No markdown. No text outside JSON. No quotes/apostrophes inside string values. CRITICAL: DO NOT wrap the JSON in markdown formatting (no backticks, no \`\`\`json). Start the response directly with {" and end with }.

PRODUCT: "${productName}" (${productType})
INGREDIENTS (${expectedCount}): "${ingredientsList}"${nutritionContext}

═══ RISK CLASSIFICATION & CONCENTRATION ═══
- First 1-5 ingredients: High concentration. Real risks.
- Middle 6-10 ingredients: Medium concentration.
- Trace ingredients (11+): Downgrade moderate to low/negligible. Do not fear-monger trace amounts.
- Default unknown/trace to negligible.
- high: ONLY if officially banned (EU/FDA) OR IARC Group 1 carcinogen.
- moderate: ONLY if strong evidence of restriction or repeated adverse effects in humans.
- low: Known mild irritation/sensitivity OR limited evidence of harm.
- negligible: Safe, GRAS, or insufficient evidence. DEFAULT for unknowns.
═══ EVIDENCE RULES (STRICT) ═══
1. NO HALLUCINATION: regulatoryStatus MUST be null unless you are 100% certain of a specific IARC classification or official EU/FDA ban. NEVER cite CFR numbers. NEVER invent percentage limits. When in doubt → null.
2. IARC USAGE: Only IARC Group 1 and 2A/2B relate to carcinogenicity — DO NOT use IARC classification for allergens, sensitizers, or endocrine claims. IARC Group 3 does NOT mean harmful.
3. EU/FDA: Only use "Banned" or "Restricted" if it is a widely established fact. "FDA approved" is NOT a valid statement for cosmetic ingredients — FDA does not pre-approve cosmetics.
4. EWG: DO NOT cite EWG scores.
═══ PROHIBITED — NEVER OUTPUT THESE ═══
- "hormone disruption" or "endocrine disruptor" for: PEG compounds, benzophenone-4, octocrylene, SLS, SLES, surfactants, sodium benzoate, potassium sorbate, emulsifiers, hexadimethrine chloride, 2,4-diaminophenoxyethanol HCL
- "IARC Group 1" or "IARC Group 2" for: fragrance allergens (linalool, limonene, coumarin, citral, hexyl cinnamal, benzyl benzoate), hair dye intermediates (PPD, m-aminophenol, resorcinol, hexadimethrine chloride, 2,4-diaminophenoxyethanol)
- "IARC Group 3" linked to ANY health harm — Group 3 means unclassifiable for carcinogenicity only, NOT a health hazard flag
- "carcinogen" for: PPD, m-aminophenol, resorcinol, hexadimethrine chloride — these are sensitizers, not carcinogens
- "FDA approved" for any cosmetic or food additive ingredient — say "permitted" or "approved for use" instead
- "EU restricted" or "EU restricted <X%" unless you know the exact Annex placement and limit
- "Restricted in EU at X%" for titanium dioxide — TiO2 regulation depends on particle size and product type
- "Consumption may trigger" for topical cosmetics — cosmetics are applied to skin, not consumed
- "high risk" or "banned" for: aspartame, steviol glycosides, stevia, sodium benzoate, E150, caramel color, ammonium hydroxide, ethanolamine, aerosol propellants (butane, propane, isobutane)
- Shea butter, cocoa butter, plant butters are NOT dairy — do not flag as milk allergen
- "sulphate" or "sulfate" in a compound like "Phenylenediamine Sulphate" is a dye salt, NOT the cleansing surfactant — do NOT flag as sulfate allergy
- EXPOSURE: ${productType === 'cosmetic' ? 'TOPICAL — applied on skin. Skin barrier limits absorption. Only flag risks proven for dermal exposure. Do not flag ingredients that are only harmful when ingested.' : 'INGESTED — enters the body. 100% bioavailable. Assess risks for oral consumption, digestion, and metabolic impact.'}
- FOOD STAPLES: Carbohydrates, starches, flour, rice, corn, oats are NEVER moderate or high risk unless they directly conflict with a users specific health condition (e.g. Diabetes, Celiac). Default negligible.
${buildUserBlock(userProfile)}
═══ OUTPUT SCHEMA ═══
JSON FORMAT EXACTLY LIKE THIS:
{
  "summary": "${hasProfile ? "1 short sentence verdict for THIS patient" : "1 short sentence about safety"}",
  "ingredients": [
    {
      "name": "string",
      "riskLevel": "high|moderate|low|negligible",
      "personalNote": "ALWAYS required. 5-8 words. ${productType === 'cosmetic' ? 'Must describe SKIN/HAIR/TOPICAL effects (e.g., pore-clogging, skin barrier). NEVER mention digestion, diet, or internal organs.' : 'Must describe INTERNAL/DIGESTIVE effects (e.g., blood sugar, gut health). NEVER mention skin application.'} Never null.",
      "regulatoryStatus": "null unless CERTAIN of IARC group or EU/FDA ban. No CFR numbers. No percentages.",
      "citation": "Source if 100% true, else null"
    }
  ]
}`
}

function buildTier2Prompt(traceIngredients: string, productType: string, productName: string, hasPoison: boolean, expectedCount: number, userProfile: any = null): string {
    let profileBlock = ''
    if (userProfile) {
        const d = (userProfile.diseases || []).filter((x: string) => x !== 'None')
        const a = (userProfile.allergies || []).filter((x: string) => x !== 'None')
        const g = (userProfile.goals || []).filter(Boolean)
        profileBlock = '\nPATIENT:'
        if (a.length) profileBlock += ` Allergies=[${a.join(',')}]`
        if (d.length) profileBlock += ` Conditions=[${d.join(',')}]`
        if (g.length) profileBlock += ` Goals=[${g.join(',')}]`
        profileBlock += `\npersonalNote: ALWAYS required. 2-5 words. ${productType === 'cosmetic' ? 'Topical effect on skin/hair. NO diet/digestion. Example: "Pore-clogging"' : 'Internal effect on body/diet. NO skin/topical. Example: "Insulin spike"'} or "🚨 Severe allergic reaction" or "✅ Beneficial for condition/goal". Never null. No apostrophes/quotes.\n`
    }

    return `Toxicology classifier. Trace-level (<1%). Output ONLY valid JSON. No markdown. No quotes inside strings. CRITICAL: DO NOT wrap the JSON in markdown formatting (no backticks, no \`\`\`json). Start the response directly with {" and end with }.

PRODUCT: "${productName}" (${productType})
TRACE: "${traceIngredients}"
COUNT: ${expectedCount}

Default "negligible". "low" ONLY if user has a matching allergy in their profile. "moderate" if restricted at <1%. "high" ONLY if banned.${hasPoison ? ' Banned substance detected — flag "high".' : ''}
${profileBlock}
JSON FORMAT EXACTLY LIKE THIS:
{
  "ingredients": [
    {
      "name": "string",
      "riskLevel": "high|moderate|low|negligible",
      "personalNote": "ALWAYS required. 2-5 words. ${productType === 'cosmetic' ? 'Topical skin/hair effect. NO diet.' : 'Internal body/diet effect. NO skin.'} Never null.",
      "citation": "Source if 100% true, else null"
    }
  ]
}`
}

// ══════════════════════════════════════════════════════
//  SMART MODEL ROUTING
//  Tier 1: llama-3.3-70b-versatile (Production, 12K TPM, best JSON accuracy)
//  Tier 2: llama-3.1-8b-instant (Production, 12K TPM, 700 tps, great for trace)
// ══════════════════════════════════════════════════════

function selectModel(ingredientCount: number, hasUserProfile: boolean, isTier2: boolean): string {
    // Tier 2 (trace ingredients, <1% concentration)
    if (isTier2) return 'meta-llama/llama-4-scout-17b-16e-instruct'
    // Tier 1: high-quality model for accurate personalization + classification
    return 'meta-llama/llama-4-scout-17b-16e-instruct'
}

// ══════════════════════════════════════════════════════
//  GROQ API CALLER
// ══════════════════════════════════════════════════════

async function callGroq(GROQ_API_KEY: string, model: string, prompt: string, maxTokens: number, isFastPass = false): Promise<any> {
    const doCall = async (tokens: number, callModel: string) => {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
            body: JSON.stringify({
                model: callModel, temperature: 0, seed: 42, max_tokens: tokens,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: isFastPass
                            ? "Precise JSON toxicology classifier. Valid JSON only. CRITICAL: DO NOT wrap the JSON in markdown formatting (no backticks, no ```json). Start the response directly with {\" and end with }."
                            : "You are a personal doctor, nutritionist, and psychologist who gives personalized health assessments. You highlight BOTH risks AND benefits for your patient with empathy and science, avoiding fear-mongering. Output ONLY valid JSON. Every ingredient in, every ingredient out. CRITICAL: DO NOT wrap the JSON in markdown formatting (no backticks, no ```json). Start the response directly with {\" and end with }."
                    },
                    { role: "user", content: prompt }
                ]
            })
        })
        if (!res.ok) {
            const errText = await res.text()
            try {
                const e = JSON.parse(errText)
                if (e?.error?.code === 'json_validate_failed' && e?.error?.failed_generation)
                    return cleanAndParseJSON(e.error.failed_generation)
            } catch { }
            throw new Error(`groq_error:${errText.substring(0, 300)}`)
        }
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content
        if (!text) throw new Error('No Groq response')
        try { return JSON.parse(text) } catch { return cleanAndParseJSON(text) }
    }

    // ── Smart Retry Logic ──
    // 1. Rate-limit / TPM errors → wait 2s, retry SAME tokens (don't escalate)
    // 2. JSON truncation errors → increase tokens by 1.4x (AI ran out of space)
    // 3. Other errors → fallback to 8B-instant model (different TPM pool)
    try {
        return await doCall(maxTokens, model)
    } catch (err: any) {
        const msg = err.message || ''
        console.warn(`⚠️ Attempt 1 failed (${model}): ${msg.substring(0, 200)}`)

        const isRateLimit = msg.includes('rate_limit') || msg.includes('too large') || msg.includes('TPM') || msg.includes('Limit')
        const isJsonTruncated = msg.includes('json_validate_failed')

        if (isRateLimit) {
            // Rate limit: wait 2s, retry same tokens — do NOT escalate
            console.log('⏳ Rate limit hit, waiting 2s before retry...')
            await new Promise(r => setTimeout(r, 2000))
            return await doCall(maxTokens, model)
        }

        if (isJsonTruncated) {
            // JSON got cut off: increase tokens modestly (1.4x, capped at 5000)
            const retryTokens = Math.min(Math.ceil(maxTokens * 1.4), 5000)
            console.log(`🔧 JSON truncated, retrying with ${retryTokens} tokens`)
            return await doCall(retryTokens, model)
        }

        // Unknown error: fallback to 8B-instant (separate TPM pool, very fast)
        console.log('🔄 Falling back to meta-llama/llama-4-scout-17b-16e-instruct')
        return await doCall(maxTokens, 'meta-llama/llama-4-scout-17b-16e-instruct')
    }
}

function cleanAndParseJSON(raw: string): any {
    let c = raw.replace(/~"/g, '"').replace(/~'/g, "'")
    c = c.replace(/\{\s*\{(\s*")/g, '{$1').replace(/\}\s*\}/g, '}').replace(/,\s*([}$$])/g, '\$1')
    try { return JSON.parse(c) } catch {
        const m = c.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0])
        throw new Error('JSON recovery failed')
    }
}

// ══════════════════════════════════════════════════════
//  ANALYSIS ORCHESTRATOR
// ══════════════════════════════════════════════════════

async function analyzeIngredients(GROQ_API_KEY: string, ingredientsList: string, productType: string, productName: string, userProfile: any, percentMap: Record<string, number> = {}, nutrientLevels: any = {}, macros: any = {}): Promise<any> {
    const rawItems = ingredientsList.split(/,\s*/)
    const hasProfile = !!(userProfile && (
        userProfile.diseases?.some((d: string) => d !== 'None') ||
        userProfile.allergies?.some((a: string) => a !== 'None') ||
        userProfile.goals?.length
    ))
    const hasPercents = Object.keys(percentMap).length > 0

    const safeSet = productType === 'cosmetic' ? SAFE_COSMETIC_MARKERS : SAFE_FOOD_MARKERS
    let profileKw: string[] = []
    if (hasProfile) {
        profileKw = [...(userProfile.diseases || []), ...(userProfile.allergies || []), ...(userProfile.goals || [])]
            .filter(x => x && x !== 'None').map(k => k.toLowerCase())
    }

    // ── Hybrid Filter: Skip safe ingredients + trace (<2%) safe items ──
    const skippedItems: { name: string, percent: number | null, position: number }[] = []
    const items = rawItems.filter((item, idx) => {
        const lower = item.toLowerCase().replace(/[.*]$/g, '').trim()
        const pct = percentMap[lower] ?? null
        const isPoisonous = containsPoison([item])
        const isProfileRelevant = profileKw.some(kw => lower.includes(kw))

        // Never skip poisons or profile-relevant ingredients
        if (isPoisonous || isProfileRelevant) return true

        // Skip if it's a known safe marker
        if (safeSet.has(lower)) {
            skippedItems.push({ name: item, percent: pct, position: idx + 1 })
            return false
        }

        // Skip trace (<2%) safe ingredients when we have percent data
        if (hasPercents && pct !== null && pct < 2 && !isPoisonous) {
            skippedItems.push({ name: item, percent: pct, position: idx + 1 })
            return false
        }

        return true
    })

    // ── Enrich AI prompt with percentages ──
    const enrichedItems = items.map(item => {
        const lower = item.toLowerCase().replace(/[.*]$/g, '').trim()
        const pct = percentMap[lower]
        return pct != null ? `${item} (${pct}%)` : item
    })
    const filteredIngredientsList = enrichedItems.join(', ')

    console.log(`🧬 Hybrid: ${rawItems.length} raw → ${items.length} to AI, ${skippedItems.length} auto-classified (${hasPercents ? 'with %' : 'no %'})`)

    if (items.length <= 15) {
        const model = selectModel(items.length, hasProfile, false)
        const maxTokens = estimateMaxTokens(items.length, userProfile)
        console.log(`📊 Single: ${items.length} ings → ${model}, ${maxTokens} tokens`)
        const result = await callGroq(GROQ_API_KEY, model, buildBarcodeScanPrompt(filteredIngredientsList, productType, productName, userProfile, items.length, nutrientLevels, macros), maxTokens)
        result.ingredients = ensureCompleteness(result.ingredients || [], ingredientsList, productType)

        // Re-inject skipped items as negligible
        for (const skipped of skippedItems) {
            const alreadyExists = result.ingredients.some((ing: any) => ing.name.toLowerCase().trim() === skipped.name.toLowerCase().trim())
            if (!alreadyExists) {
                result.ingredients.push({
                    name: skipped.name, position: skipped.position,
                    category: 'safe', riskLevel: 'negligible' as RiskLevel,
                    personalNote: getBodyFunction(skipped.name, productType === 'cosmetic'), regulatoryStatus: null,
                })
            }
        }

        const rawLower = rawItems.map(r => r.toLowerCase().trim())
        result.ingredients.forEach((ing: any) => {
            const rIdx = rawLower.findIndex(r => r === ing.name.toLowerCase().trim() || r.includes(ing.name.toLowerCase().trim()))
            if (rIdx !== -1) ing.position = rIdx + 1
        })
        result.ingredients.sort((a: any, b: any) => (a.position || 999) - (b.position || 999))

        if (!result.healthScores?.length && userProfile) {
            result.healthScores = computeHealthScores(result.ingredients, userProfile)
        }
        return result
    }

    let splitPos = findSplitPosition(items, productType === 'cosmetic')
    if (splitPos === 0) splitPos = Math.max(1, Math.ceil(items.length * 0.4))
    if (splitPos === items.length) splitPos = items.length - 1
    const t1 = items.slice(0, splitPos), t2 = items.slice(splitPos)

    // Enrich tier prompts with percentages too
    const t1Enriched = t1.map(item => { const p = percentMap[item.toLowerCase().replace(/[.*]$/g, '').trim()]; return p != null ? `${item} (${p}%)` : item })
    const t2Enriched = t2.map(item => { const p = percentMap[item.toLowerCase().replace(/[.*]$/g, '').trim()]; return p != null ? `${item} (${p}%)` : item })

    const model1 = selectModel(t1.length, hasProfile, false)
    const model2 = selectModel(t2.length, false, true)
    console.log(`📊 Tiered: ${t1.length}→${model1} + ${t2.length}→${model2}`)

    const [r1, r2] = await Promise.all([
        callGroq(GROQ_API_KEY, model1, buildBarcodeScanPrompt(t1Enriched.join(', '), productType, productName, userProfile, t1.length, nutrientLevels, macros), estimateMaxTokens(t1.length, userProfile)),
        callGroq(GROQ_API_KEY, model2, buildTier2Prompt(t2Enriched.join(', '), productType, productName, containsPoison(t2), t2.length, userProfile), estimateMaxTokens(t2.length, userProfile, true)),
    ])

    const t1Ings = ensureCompleteness(r1.ingredients || [], t1.join(', '), productType)
    const t2Ings = ensureCompleteness(r2.ingredients || [], t2.join(', '), productType)

    let all = [...t1Ings, ...t2Ings]
    all = ensureCompleteness(all, ingredientsList, productType)

    // Re-inject skipped items
    for (const skipped of skippedItems) {
        const alreadyExists = all.some(ing => ing.name.toLowerCase().trim() === skipped.name.toLowerCase().trim())
        if (!alreadyExists) {
            all.push({
                name: skipped.name, position: skipped.position,
                category: 'safe', riskLevel: 'negligible' as RiskLevel,
                personalNote: getBodyFunction(skipped.name, productType === 'cosmetic'), regulatoryStatus: null,
            })
        }
    }

    const rawLower = rawItems.map(r => r.toLowerCase().trim())
    all.forEach(ing => {
        const rIdx = rawLower.findIndex(r => r === ing.name.toLowerCase().trim() || r.includes(ing.name.toLowerCase().trim()))
        if (rIdx !== -1) ing.position = rIdx + 1
    })
    all.sort((a, b) => (a.position || 999) - (b.position || 999))

    const personalizedCount = all.filter((i: any) => i.personalNote).length
    console.log(`✅ Final: ${all.length} (expected ${rawItems.length}), personalized: ${personalizedCount}`)

    const healthScores = r1.healthScores?.length ? r1.healthScores : (userProfile ? computeHealthScores(all, userProfile) : [])

    return {
        summary: r1.summary || '',
        healthScores,
        ingredients: all,
    }
}

// ── Refund Scan Credit Helper ──
// Decrements scan counters by 1 when a scan fails gracefully (e.g., product not found)
// so the user doesn't lose their credit for a failed scan.
async function refundScanCredit(userId: string, isTester: boolean): Promise<void> {
    if (userId === 'anonymous' || isTester) return
    try {
        const serviceKey = Deno.env.get('MED_SUPABASE_SERVICE_ROLE_KEY')
        const SUPABASE_URL = Deno.env.get('MED_SUPABASE_URL')
        if (!serviceKey || !SUPABASE_URL) return

        const adminClient = createClient(SUPABASE_URL, serviceKey)
        const { data: usage } = await adminClient.from('scan_usage')
            .select('daily_scans, weekly_scans, monthly_scans')
            .eq('user_id', userId).single()

        if (usage) {
            const newDaily = Math.max(0, usage.daily_scans - 1)
            await adminClient.from('scan_usage').update({
                daily_scans: newDaily,
                weekly_scans: Math.max(0, usage.weekly_scans - 1),
                monthly_scans: Math.max(0, usage.monthly_scans - 1)
            }).eq('user_id', userId)
            await adminClient.from('users').update({ daily_scans: newDaily }).eq('id', userId)
            console.log(`🔄 Refunded scan credit for user ${userId}`)
        }
    } catch (err) {
        console.error('Refund failed:', err)
    }
}

// ══════════════════════════════════════════════════════
//  MAIN HANDLER
// ══════════════════════════════════════════════════════

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    let userId = 'anonymous';
    let isTester = false;

    try {
        const SUPABASE_URL = Deno.env.get('MED_SUPABASE_URL')
        const SUPABASE_ANON_KEY = Deno.env.get('MED_SUPABASE_ANON_KEY')

        // ── GROQ API KEY ROUND ROBIN ──
        // Auto-collects GROQ_KEY1 through GROQ_KEY10 — just add secrets to scale
        const groqKeys: string[] = []
        for (let i = 1; i <= 10; i++) {
            const k = Deno.env.get(`GROQ_KEY${i}`)
            if (k) groqKeys.push(k.trim())
        }
        // Fallback to legacy GROQ_API_KEY if no numbered keys exist
        if (groqKeys.length === 0) {
            const legacy = Deno.env.get('GROQ_API_KEY')
            if (legacy) groqKeys.push(legacy.trim())
        }

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Missing Supabase Config')
        if (groqKeys.length === 0) throw new Error('Missing Groq API Keys')

        // Rotate key every 30 minutes based on UTC
        const keyIndex = Math.floor((new Date().getUTCHours() * 60 + new Date().getUTCMinutes()) / 30) % groqKeys.length
        const GROQ_API_KEY = groqKeys[keyIndex]
        console.log(`🔑 Groq Key ${keyIndex + 1}/${groqKeys.length}`)

        const authHeader = req.headers.get('Authorization')
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: authHeader ? { Authorization: authHeader } : {} } })

        let userProfile: any = null
        if (authHeader) {
            try {
                const { data: { user }, error } = await supabase.auth.getUser()
                if (!error && user) {
                    userId = user.id
                    isTester = user.email === 'tester@medicalgpt.ai'
                }
            } catch { console.warn('Auth failed') }
        }

        // ── FREE TIER: 1 scan/day for free users. Server rate limit enforced below. ──
        let FREE_TIER_ENABLED = true;
        
        // Fetch app_settings to check high_traffic_mode
        const { data: appSettings } = await supabase.from('app_settings').select('high_traffic_mode').limit(1).single();
        if (appSettings && appSettings.high_traffic_mode) {
            FREE_TIER_ENABLED = false;
        }

        if (!FREE_TIER_ENABLED && !isTester) {
            let isPro = false;
            if (userId !== 'anonymous') {
                const { data: userRecord } = await supabase.from('users').select('is_pro').eq('id', userId).single();
                isPro = !!userRecord?.is_pro;
            }
            if (!isPro) {
                return new Response(JSON.stringify({ upgradeRequired: true }), {
                    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        }

        // ── STRICT RATE LIMITING ──
        if (userId !== 'anonymous' && !isTester) {
            const { error: usageError } = await supabase.rpc('increment_scan_usage', { p_user_id: userId });
            if (usageError) {
                if (usageError.message?.includes('RATE_LIMIT_EXCEEDED') || usageError.message?.includes('Limit')) {
                    return new Response(JSON.stringify({ upgradeRequired: true }), {
                        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }
                console.error('Usage increment error:', usageError);
            }
        }

        const { barcode, category, clientData, healthPreferences } = (await req.json()) as any
        const percentMap: Record<string, number> = clientData?.ingredientPercents || {}
        if (!barcode) {
            await refundScanCredit(userId, isTester)
            return new Response(JSON.stringify({ error: 'Barcode required' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        if (healthPreferences && (healthPreferences.diseases?.length || healthPreferences.allergies?.length || healthPreferences.goals?.length)) {
            userProfile = healthPreferences
            console.log(`✅ User ${userId} | Profile: from client`)
        } else if (userId !== 'anonymous') {
            userProfile = await fetchUserHealthProfile(supabase, userId)
            console.log(`✅ User ${userId} | Profile: ${userProfile ? 'from DB' : 'none'}`)
        } else {
            console.log(`✅ User anonymous | Profile: none`)
        }

        const hasClientData = clientData?.ingredientsText?.trim().length > 0

        let productName: string, brand: string, imageUrl: string | null, macros: any,
            nutriGrade: string | null, novaGroup: number | null, allergens: string[],
            additives: string[], nutrientLevels: any, categories: string, ingredientsList: string,
            ingredients_analysis_tags: string[] = [], traces: string[] = [], micros: any = {}

        if (hasClientData) {
            productName = clientData.productName || 'Unknown Product'
            brand = clientData.brand || ''
            imageUrl = clientData.imageUrl || null
            macros = clientData.macros || {}
            nutriGrade = clientData.nutriscore?.toUpperCase() || null
            novaGroup = clientData.novaGroup || null
            allergens = clientData.allergens || []
            traces = clientData.traces || []
            additives = clientData.additives || []
            nutrientLevels = clientData.nutrientLevels || {}
            categories = clientData.categories || ''
            ingredientsList = clientData.ingredientsText
            ingredients_analysis_tags = clientData.ingredients_analysis_tags || []

            // Filter safe additives from the additives array (don't need AI for these)
            const dangerousAdditives = additives.filter((a: string) => {
                const normalized = a.toLowerCase().replace(/[^a-z0-9]/g, '')
                return !SAFE_ADDITIVES.has(normalized)
            })
            if (dangerousAdditives.length < additives.length) {
                console.log(`🧪 Additives: ${additives.length} total, ${dangerousAdditives.length} non-trivial, ${additives.length - dangerousAdditives.length} safe (skipped)`)
            }
        } else {
            const requiredFields = 'product_name,product_name_en,brands,image_front_url,image_url,nutriments,nutriscore_grade,nutrition_grades,nova_group,allergens_tags,additives_tags,nutrient_levels,categories,ingredients_analysis_tags,ingredients_text,ingredients_text_en,ingredients_text_en_imported,ingredients,traces_tags'
            const apiUrl = category === 'cosmetics'
                ? `https://world.openbeautyfacts.org/api/v2/product/${barcode}?fields=${requiredFields}`
                : `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${requiredFields}`
            const apiRes = await fetch(apiUrl)
            if (!apiRes.ok) {
                await refundScanCredit(userId, isTester)
                return new Response(JSON.stringify({ error: 'Product not found', fallback: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
            }
            const apiData = await apiRes.json()
            if (!apiData.product) {
                await refundScanCredit(userId, isTester)
                return new Response(JSON.stringify({ error: 'Product not found', fallback: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
            }

            const p = apiData.product
            productName = p.product_name || p.product_name_en || 'Unknown Product'
            brand = p.brands || ''
            imageUrl = p.image_front_url || p.image_url || null
            const n = p.nutriments || {}
            macros = {
                calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
                protein: Math.round((n.proteins_100g || 0) * 10) / 10,
                carbs: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
                fats: Math.round((n.fat_100g || 0) * 10) / 10,
                sugar: Math.round((n.sugars_100g || 0) * 10) / 10,
                fiber: Math.round((n.fiber_100g || 0) * 10) / 10,
                salt: Math.round((n.salt_100g || 0) * 100) / 100,
                saturatedFat: Math.round((n['saturated-fat_100g'] || 0) * 10) / 10,
            }
            micros = {
                vitamin_a: n['vitamin-a_100g'] || n['vitamin-a_value'] || n['vitamin-a'] || null,
                vitamin_c: n['vitamin-c_100g'] || n['vitamin-c_value'] || n['vitamin-c'] || null,
                vitamin_d: n['vitamin-d_100g'] || n['vitamin-d_value'] || n['vitamin-d'] || null,
                vitamin_e: n['vitamin-e_100g'] || n['vitamin-e_value'] || n['vitamin-e'] || null,
                vitamin_b1: n['vitamin-b1_100g'] || n['vitamin-b1_value'] || null,
                vitamin_b2: n['vitamin-b2_100g'] || n['vitamin-b2_value'] || null,
                vitamin_b3: n['vitamin-pp_100g'] || n['vitamin-pp_value'] || n['niacin_100g'] || n['niacin_value'] || null,
                vitamin_b6: n['vitamin-b6_100g'] || n['vitamin-b6_value'] || null,
                vitamin_b9: n['vitamin-b9_100g'] || n['vitamin-b9_value'] || n['folates_100g'] || n['folates_value'] || null,
                vitamin_b12: n['vitamin-b12_100g'] || n['vitamin-b12_value'] || n['vitamin-b12'] || null,
                pantothenic_acid: n['pantothenic-acid_100g'] || n['pantothenic-acid_value'] || null,
                calcium: n['calcium_100g'] || n['calcium_value'] || n['calcium'] || null,
                iron: n['iron_100g'] || n['iron_value'] || n['iron'] || null,
                zinc: n['zinc_100g'] || n['zinc_value'] || n['zinc'] || null,
                magnesium: n['magnesium_100g'] || n['magnesium_value'] || n['magnesium'] || null,
                potassium: n['potassium_100g'] || n['potassium_value'] || n['potassium'] || null,
                sodium: n['sodium_100g'] || n['sodium_value'] || n['sodium'] || null,
                phosphorus: n['phosphorus_100g'] || n['phosphorus_value'] || null,
                copper: n['copper_100g'] || n['copper_value'] || null,
                manganese: n['manganese_100g'] || n['manganese_value'] || null,
                selenium: n['selenium_100g'] || n['selenium_value'] || null,
                iodine: n['iodine_100g'] || n['iodine_value'] || null,
            }
            // cleanup null micros
            Object.keys(micros).forEach(key => { if (micros[key] === null || micros[key] === undefined) delete micros[key] })

            nutriGrade = (p.nutriscore_grade || p.nutrition_grades || '').toUpperCase() || null
            novaGroup = p.nova_group || null
            allergens = (p.allergens_tags || []).map((t: string) => t.replace('en:', ''))
            traces = (p.traces_tags || []).map((t: string) => t.replace('en:', ''))
            additives = (p.additives_tags || []).map((t: string) => t.replace('en:', ''))
            nutrientLevels = p.nutrient_levels || {}
            categories = p.categories || ''
            ingredients_analysis_tags = (p.ingredients_analysis_tags || []).map((t: string) => t.replace('en:', '').replace(/-/g, ' '))

            const rawText = p.ingredients_text_en_imported || p.ingredients_text_en || p.ingredients_text || ''
            const parsedNames: string[] = []

            // ONLY extract from array if imported text is missing, because imported text is much cleaner than array
            if (!p.ingredients_text_en_imported) {
                const extractNames = (ings: any[]) => {
                    for (const ing of ings) {
                        let name = ''
                        if (ing.text) name = ing.text.split(/\s+\/\s+/)[0].trim()
                        else if (ing.id) name = ing.id.replace('en:', '').replace(/-/g, ' ')
                        if (name) parsedNames.push(name)
                        if (ing.ingredients?.length > 0) extractNames(ing.ingredients)
                    }
                }
                if (p.ingredients?.length > 0) extractNames(p.ingredients)
            }
            ingredientsList = p.ingredients_text_en_imported ? p.ingredients_text_en_imported : (parsedNames.length > 0 ? parsedNames.join(', ') : rawText)

            if (!ingredientsList?.trim()) {
                await refundScanCredit(userId, isTester)
                return new Response(JSON.stringify({ error: 'Ingredients not available', noIngredients: true, fallback: true, productName, brand, imageUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
            }
        }

        const rawLength = ingredientsList.length
        ingredientsList = normalizeIngredientText(ingredientsList, category === 'cosmetics' ? 'cosmetic' : 'food')
        const ingredientItems = splitIngredients(ingredientsList)
        ingredientsList = ingredientItems.join(', ')
        console.log(`📝 Normalized: ${rawLength} chars → ${ingredientItems.length} ingredients`)

        if (ingredientItems.length === 0) {
            return new Response(JSON.stringify({ error: 'Could not parse ingredients', fallback: true, productName, brand }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const productType = category === 'cosmetics' ? 'cosmetic' : 'food'

        let aiResult: any
        console.log(`🧪 AI analysis for ${barcode} (${ingredientItems.length} ingredients)...`)

        try {
            aiResult = await analyzeIngredients(GROQ_API_KEY, ingredientsList, productType, productName, userProfile, percentMap, nutrientLevels, macros)
        } catch (aiErr: any) {
            console.error('❌ AI failed:', aiErr.message)
            const fallback = ingredientItems.map((name, i) => {
                const isPoisonous = containsPoison([name])
                return {
                    name, position: i + 1,
                    category: null,
                    riskLevel: isPoisonous ? 'high' : 'low' as const,
                    personalNote: isPoisonous ? 'Cancer risk - restricted substance' : getBodyFunction(name, productType === 'cosmetic'), regulatoryStatus: null,
                }
            })
            const toxScore = computeToxicityScore(fallback)
            return new Response(JSON.stringify({
                productName, brand, barcode, productType, imageUrl, method: 'barcode',
                overallGrade: computeGrade(toxScore), grade: computeGrade(toxScore),
                toxicityScore: toxScore, score: toxScore,
                nutriGrade, novaGroup, summary: 'AI temporarily unavailable. Basic safety analysis shown.',
                healthScores: [], ingredients: fallback,
                harmful_chemicals: fallback.filter(i => i.riskLevel === 'high').map(i => ({
                    name: i.name, category: i.category, riskLevel: i.riskLevel,
                    personalNote: i.personalNote, regulatoryStatus: null
                })),
                macros, micros, allergens, traces, additives, nutrientLevels, categories, aiFallback: true,
                ingredients_analysis_tags
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const ingredients = aiResult.ingredients || []

        // ── REGULATORY STATUS FILTER: Replace AI-generated regulatory with verified data ──
        for (const ing of ingredients) {
            ing.regulatoryStatus = filterRegulatoryStatus(ing.name || '', ing.regulatoryStatus || null, productType)
        }

        // ── RISK OVERRIDE: Correct AI misclassifications before allergen elevation ──
        // Must run BEFORE elevateAllergenIngredients so allergen elevation always wins
        applyRiskOverrides(ingredients, userProfile)

        // ── Server-side safety net: Guarantee personalNote on EVERY ingredient ──
        // Layer 1: Risky ingredients get category-based fallbacks
        // Layer 2: Safe ingredients get body-function descriptions
        for (const ing of ingredients) {
            if (!ing.personalNote) {
                if (ing.riskLevel === 'high' || ing.riskLevel === 'moderate') {
                    const cat = (ing.category || '').toLowerCase()
                    const fallbacks: Record<string, string> = {
                        'carcinogen': 'Cancer risk - restricted substance',
                        'endocrine_disruptor': 'Hormone disruption risk',
                        'neurotoxin': 'Nervous system risk',
                        'irritant': 'Skin/body irritation risk',
                        'allergen': '🚨 Potential allergic reaction',
                    }
                    ing.personalNote = fallbacks[cat] || `${ing.riskLevel === 'high' ? 'Banned' : 'Restricted'} - review before use`
                } else {
                    ing.personalNote = getBodyFunction(ing.name || '', productType === 'cosmetic')
                }
            }
        }

        // ── Allergen Elevation: Forcefully flag ingredients matching user allergies ──
        const customAllergensHit = elevateAllergenIngredients(ingredients, userProfile)
        allergens = Array.from(new Set([...allergens, ...customAllergensHit]))

        const toxicityScore = computeToxicityScore(ingredients, novaGroup, additives.length, userProfile)
        const overallGrade = computeGrade(toxicityScore, customAllergensHit.length > 0)
        const harmfulChemicals = ingredients
            .filter((ing: any) => ing.riskLevel === 'high' || ing.riskLevel === 'moderate')
            .map((ing: any) => ({
                name: ing.name, category: ing.category || null, riskLevel: ing.riskLevel,
                personalNote: ing.personalNote || null,
                regulatoryStatus: ing.regulatoryStatus || null,
            }))

        const personalizedCount = ingredients.filter((i: any) => i.personalNote).length
        const beneficialCount = ingredients.filter((i: any) => i.personalNote?.startsWith('✅')).length
        console.log(`✅ Done: ${ingredients.length} ings, grade=${overallGrade}, harmful=${harmfulChemicals.length}, personalized=${personalizedCount}, beneficial=${beneficialCount}`)

        return new Response(JSON.stringify({
            productName, brand, barcode, productType, imageUrl, method: 'barcode',
            overallGrade, grade: overallGrade, toxicityScore, score: toxicityScore,
            nutriGrade, novaGroup, summary: aiResult.summary || '',
            healthScores: aiResult.healthScores || [],
            ingredients, harmful_chemicals: harmfulChemicals,
            macros, micros, allergens, traces, additives, nutrientLevels, categories, ingredients_analysis_tags
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

    } catch (error) {
        console.error(error)

        // ── CRASH REFUND ──
        await refundScanCredit(userId, isTester)

        return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
})