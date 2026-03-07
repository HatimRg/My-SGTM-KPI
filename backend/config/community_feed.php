<?php

return [
    'publisher_roles' => [
        'admin', 'dev', 'consultation', 'pole_director', 'works_director', 'hse_director',
        'hr_director', 'hse_manager', 'regional_hse_manager', 'responsable', 'supervisor',
    ],

    'reaction_types' => ['like', 'praying_hands', 'sad', 'heart', 'red_helmet'],

    // Terms are normalized/fuzzy-checked by CommunityModerationService.
    'blocked_terms' => [
        // English
        'fuck','fucking','motherfucker','fucker','shit','bullshit','bitch','bastard','asshole','dickhead','slut','whore','cunt','piss off','son of a bitch','wtf',
        // French
        'pute','putain','salope','connard','connasse','encule','enculé','enculee','merde','bordel','ta gueule','nique ta mere','fils de pute','batard','batarde',
        // Darija latin/translit
        'zamel','zaml','9ahba','kahba','qahba','weld l97ba','wld l97ba','zebi','zebbi','tbn','teboun','sir t9awed','t9awed','7mar','hmar','mklkh','m9wd','m9awda',
        // Arabic
        'قحبة','كلب','حمار','زب','زبّي','نيك','تبون','تفو','تفو عليك','ابن القحبة','ولد القحبة','شرموطة','كلخ','تفو عليكم',
    ],
];
