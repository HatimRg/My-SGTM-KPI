import { getLocalized, formatBulletText } from './veilleReglementaireSchema'

export const SCHEMA_VERSION = 'v3_env'

export const SECTION_ENV_CHARTE = {
  section_id: 'env_charte',
  title: {
    fr: '1. Charte',
    en: '1. Charter',
  },
  chapters: [
    {
      chapter_id: 'charte',
      title: {
        fr: 'Charte',
        en: 'Charter',
      },
      articles: [
        {
          article_id: 'env_charte_21',
          code: { fr: 'Article 21', en: 'Article 21' },
          text: {
            fr: "Les établissements publics et sociétés d’Etat, notamment ceux exerçant une activité industrielle et commerciale et les entreprises privées s’engagent à respecter les principes et les objectifs prévus par la présente loi-cadre. A cet effet, ils veillent à:\n- adopter les modes et méthodes d’approvisionnement, d’exploitation, de production et de gestion responsables, répondant aux exigences du développement durable;\n- évaluer périodiquement l’impact de leurs activités sur l’environnement;\n- réduire au strict minimum les effets négatifs de leurs activités sur les milieux et les écosystèmes dans lesquels ils sont implantés;\n- contribuer à la diffusion des valeurs du développement durable en exigeant de leurs partenaires, notamment de leurs fournisseurs, le respect de l’environnement et desdites valeurs;\n- adopter une communication transparente sur leur gestion environnementale.",
            en: "Les établissements publics et sociétés d’Etat, notamment ceux exerçant une activité industrielle et commerciale et les entreprises privées s’engagent à respecter les principes et les objectifs prévus par la présente loi-cadre. A cet effet, ils veillent à:\n- adopter les modes et méthodes d’approvisionnement, d’exploitation, de production et de gestion responsables, répondant aux exigences du développement durable;\n- évaluer périodiquement l’impact de leurs activités sur l’environnement;\n- réduire au strict minimum les effets négatifs de leurs activités sur les milieux et les écosystèmes dans lesquels ils sont implantés;\n- contribuer à la diffusion des valeurs du développement durable en exigeant de leurs partenaires, notamment de leurs fournisseurs, le respect de l’environnement et desdites valeurs;\n- adopter une communication transparente sur leur gestion environnementale.",
          },
        },
      ],
    },
  ],
}

export const SECTION_ENV_EIID = {
  section_id: 'env_eiid',
  title: {
    fr: '2. EIID',
    en: '2. EIID',
  },
  chapters: [
    {
      chapter_id: 'eiid',
      title: {
        fr: "Établissements insalubres, incommodes ou dangereux (EIID)",
        en: 'Unhealthy, Inconvenient or Dangerous Establishments (EIID)',
      },
      articles: [
        {
          article_id: 'env_eiid_1',
          code: { fr: 'Article 1', en: 'Article 1' },
          text: {
            fr: "Les établissements qui présentent des causes d'insalubrité, d'incommodité ou de danger sont soumis au contrôle et à la surveillance de l'autorité administrative.\nToutefois, les établissements de cette nature appartenant à l'autorité militaire ne sont pas soumis aux dispositions du présent dahir ; ces établissements devront cependant être installés de manière à présenter, notamment en ce qui concerne la protection du voisinage, toutes les garanties de sécurité requises pour les établissements civils de même catégorie.",
            en: "Les établissements qui présentent des causes d'insalubrité, d'incommodité ou de danger sont soumis au contrôle et à la surveillance de l'autorité administrative.\nToutefois, les établissements de cette nature appartenant à l'autorité militaire ne sont pas soumis aux dispositions du présent dahir ; ces établissements devront cependant être installés de manière à présenter, notamment en ce qui concerne la protection du voisinage, toutes les garanties de sécurité requises pour les établissements civils de même catégorie.",
          },
        },
        {
          article_id: 'env_eiid_2',
          code: { fr: 'Article 2', en: 'Article 2' },
          text: {
            fr: "Ces établissements sont divisés en trois classes suivant la nature des opérations qui y sont effectuées ou les inconvénients qu'ils présentent au point de vue de la sécurité, de la salubrité ou de la commodité publiques. La nomenclature et le classement desdits établissements seront déterminés par arrêté de Notre Grand Vizir, sur la proposition du directeur général des travaux publics (1).\n(1) V. A. V. 13 octobre. 1933 - 22 joumada II 1352.",
            en: "Ces établissements sont divisés en trois classes suivant la nature des opérations qui y sont effectuées ou les inconvénients qu'ils présentent au point de vue de la sécurité, de la salubrité ou de la commodité publiques. La nomenclature et le classement desdits établissements seront déterminés par arrêté de Notre Grand Vizir, sur la proposition du directeur général des travaux publics (1).\n(1) V. A. V. 13 octobre. 1933 - 22 joumada II 1352.",
          },
        },
        {
          article_id: 'env_eiid_arretes',
          code: { fr: 'Arrêtés', en: 'Decrees' },
          text: {
            fr: "- Arrêté 1933 portant classement des établissements insalubres, incommodes ou dangereux\n- Arrêté 1939 assimilant certains établissements insalubres, incommodes ou dangereux en ce qui concerne leur installation dans des zones réservées à l'habitation\n- Arrêté 1950 interdisant l'installation de certaines industries dans les villes municipales et les centres délimités par arrêté viziriel, avec leurs zones de banlieue ou leurs zones périphériques",
            en: "- Arrêté 1933 portant classement des établissements insalubres, incommodes ou dangereux\n- Arrêté 1939 assimilant certains établissements insalubres, incommodes ou dangereux en ce qui concerne leur installation dans des zones réservées à l'habitation\n- Arrêté 1950 interdisant l'installation de certaines industries dans les villes municipales et les centres délimités par arrêté viziriel, avec leurs zones de banlieue ou leurs zones périphériques",
          },
        },
        {
          article_id: 'env_eiid_4',
          code: { fr: 'Article 4', en: 'Article 4' },
          text: {
            fr: "Les établissements rangés dans la première ou la deuxième classe ne peuvent être ouverts sans une autorisation préalable. Cette autorisation est délivrée par arrêté du pacha ou caïd, sur avis de l'autorité municipale ou locale de contrôle, pour les établissements de la deuxième classe. Les établissements rangés dans la troisième classe doivent faire l'objet, avant leur ouverture, d'une déclaration écrite adressée à l'autorité municipale ou locale de contrôle du lieu où sera situé l'établissement.",
            en: "Les établissements rangés dans la première ou la deuxième classe ne peuvent être ouverts sans une autorisation préalable. Cette autorisation est délivrée par arrêté du pacha ou caïd, sur avis de l'autorité municipale ou locale de contrôle, pour les établissements de la deuxième classe. Les établissements rangés dans la troisième classe doivent faire l'objet, avant leur ouverture, d'une déclaration écrite adressée à l'autorité municipale ou locale de contrôle du lieu où sera situé l'établissement.",
          },
        },
      ],
    },
  ],
}

export const SECTION_ENV_EIE = {
  section_id: 'env_eie',
  title: {
    fr: '3. EIE',
    en: '3. EIA',
  },
  chapters: [
    {
      chapter_id: 'eie',
      title: {
        fr: "Étude d'impact sur l'environnement (EIE)",
        en: 'Environmental impact assessment (EIA)',
      },
      articles: [
        {
          article_id: 'env_eie_2_7',
          code: { fr: 'Article 2 et 7', en: 'Article 2 & 7' },
          text: {
            fr: "Tous les projets mentionnés dans la liste annexée à la présente loi, entrepris par toute personne physique ou morale, privée ou publique, qui en raison de leur nature, de leur dimension ou de leur lieu d'implantation risquent de produire des impacts négatifs sur le milieu biophysique et humain, font l'objet d'une étude d'impact sur l'environnement.\nL'autorisation de tout projet soumis à l'étude d'impact sur l'environnement est subordonnée à une décision d'acceptabilité environnementale. Cette décision constitue l'un des documents du dossier de la demande présentée en vue de l'obtention de l'autorisation du projet.",
            en: "Tous les projets mentionnés dans la liste annexée à la présente loi, entrepris par toute personne physique ou morale, privée ou publique, qui en raison de leur nature, de leur dimension ou de leur lieu d'implantation risquent de produire des impacts négatifs sur le milieu biophysique et humain, font l'objet d'une étude d'impact sur l'environnement.\nL'autorisation de tout projet soumis à l'étude d'impact sur l'environnement est subordonnée à une décision d'acceptabilité environnementale. Cette décision constitue l'un des documents du dossier de la demande présentée en vue de l'obtention de l'autorisation du projet.",
          },
        },
        {
          article_id: 'env_eie_liste',
          code: { fr: 'Liste des projets', en: 'Project list' },
          text: {
            fr: "1 - Etablissements insalubres, incommodes ou dangereux classés en première catégorie.\n2 - Projets d'infrastructures\n- Construction de routes (routes nationales et autoroutes);\n- Voies ferrées;\n- Aéroports;\n- Aménagement de zones urbaines;\n- Aménagement de zones industrielles;\n- Ports de commerce et ports de plaisance;\n- Barrages ou toutes autres installations destinées à retenir et à stocker les eaux d'une manière permanente;\n- Complexes touristiques, notamment ceux situés au littoral, à la montagne et en milieu rural;\n- Installations de stockage ou d'élimination de déchets quel que soit leur nature et la méthode de leur élimination;\n- Stations d'épuration des eaux usées et ouvrages annexes;\n- Emissaires d'évacuation marin;\n- Transport de matières dangereuses ou toxiques.\n3 - Projets industriels\n3.1 - Industrie extractive :\n- Mines;\n- Carrières de sable et gravier;\n- Cimenteries;\n- Industrie de plâtre;\n- Transformation du liège.\n3.2 - Industrie de l'énergie :\n- Installations destinées au stockage du gaz et tous produits inflammables;\n- Raffineries de pétrole;\n- Grands travaux de transfert d'énergie;\n- Centrales thermiques et autres installations à combustion puissance calorifique d'au moins 300 MW;\n- Centrales nucléaires;\n- Centrales hydroélectriques.\n3.3 - Industrie chimique :\n- Installations de fabrication de produits chimiques, de pesticides, de produits pharmaceutiques, de peintures de vernis, d'élastomères et peroxydes;\n- Lancement de nouveaux produits chimiques sur le marché;\n- Extraction, traitement et transformation d'amiante.\n3.4 - Traitement des métaux :\n- Usines sidérurgiques;\n- Traitement de surface et revêtement des métaux;\n- Chaudronnerie et appareils métalliques.\n3.5 - Industrie des produits alimentaires :\n- Conserverie de produits animal et végétal;\n- Fabrication de produits laitiers;\n- Brasserie;\n- Fabrication de confiseries et de boissons;\n- Usines de farine de poisson et d'huile de poisson;\n- Féculerie industrielle;\n- Sucreries et transformation de mélasses;\n- Minoteries et semouleries;\n- Huileries.\n3.6 - Industrie textile, du cuir, du bois, du papier, de carton et de poterie :\n- Fabrication de pâte à papier, de papier et de carton;\n- Tanneries et mégisserie;\n- Production et traitement de cellulose;\n- Teinturerie de fibres;\n- Fabrication de panneaux de fibres, de particules et de contre-plaqués;\n- Industrie de textile et teintureries;\n- Poterie.\n3.7 - Industrie de caoutchouc :\n- Fabrication et traitement de produits à base d'élastomères.\n4 - Agriculture\n- Projets de remembrement rural;\n- Projets de reboisement d'une superficie supérieur à 100 hectares;\n- Projets d'affectation de terre inculte ou d'étendue semi-naturelle à l'exploitation agricole intensive.\n5 - Projets d'aquaculture et de pisciculture",
            en: "1 - Etablissements insalubres, incommodes ou dangereux classés en première catégorie.\n2 - Projets d'infrastructures\n- Construction de routes (routes nationales et autoroutes);\n- Voies ferrées;\n- Aéroports;\n- Aménagement de zones urbaines;\n- Aménagement de zones industrielles;\n- Ports de commerce et ports de plaisance;\n- Barrages ou toutes autres installations destinées à retenir et à stocker les eaux d'une manière permanente;\n- Complexes touristiques, notamment ceux situés au littoral, à la montagne et en milieu rural;\n- Installations de stockage ou d'élimination de déchets quel que soit leur nature et la méthode de leur élimination;\n- Stations d'épuration des eaux usées et ouvrages annexes;\n- Emissaires d'évacuation marin;\n- Transport de matières dangereuses ou toxiques.\n3 - Projets industriels\n3.1 - Industrie extractive :\n- Mines;\n- Carrières de sable et gravier;\n- Cimenteries;\n- Industrie de plâtre;\n- Transformation du liège.\n3.2 - Industrie de l'énergie :\n- Installations destinées au stockage du gaz et tous produits inflammables;\n- Raffineries de pétrole;\n- Grands travaux de transfert d'énergie;\n- Centrales thermiques et autres installations à combustion puissance calorifique d'au moins 300 MW;\n- Centrales nucléaires;\n- Centrales hydroélectriques.\n3.3 - Industrie chimique :\n- Installations de fabrication de produits chimiques, de pesticides, de produits pharmaceutiques, de peintures de vernis, d'élastomères et peroxydes;\n- Lancement de nouveaux produits chimiques sur le marché;\n- Extraction, traitement et transformation d'amiante.\n3.4 - Traitement des métaux :\n- Usines sidérurgiques;\n- Traitement de surface et revêtement des métaux;\n- Chaudronnerie et appareils métalliques.\n3.5 - Industrie des produits alimentaires :\n- Conserverie de produits animal et végétal;\n- Fabrication de produits laitiers;\n- Brasserie;\n- Fabrication de confiseries et de boissons;\n- Usines de farine de poisson et d'huile de poisson;\n- Féculerie industrielle;\n- Sucreries et transformation de mélasses;\n- Minoteries et semouleries;\n- Huileries.\n3.6 - Industrie textile, du cuir, du bois, du papier, de carton et de poterie :\n- Fabrication de pâte à papier, de papier et de carton;\n- Tanneries et mégisserie;\n- Production et traitement de cellulose;\n- Teinturerie de fibres;\n- Fabrication de panneaux de fibres, de particules et de contre-plaqués;\n- Industrie de textile et teintureries;\n- Poterie.\n3.7 - Industrie de caoutchouc :\n- Fabrication et traitement de produits à base d'élastomères.\n4 - Agriculture\n- Projets de remembrement rural;\n- Projets de reboisement d'une superficie supérieur à 100 hectares;\n- Projets d'affectation de terre inculte ou d'étendue semi-naturelle à l'exploitation agricole intensive.\n5 - Projets d'aquaculture et de pisciculture",
          },
        },
      ],
    },
  ],
}

export const SECTION_ENV_AIR = {
  section_id: 'env_air',
  title: {
    fr: '4. Air',
    en: '4. Air',
  },
  chapters: [
    {
      chapter_id: 'pollution_air',
      title: {
        fr: 'Loi n° 13-03 relative à la lutte contre la pollution de l\'air',
        en: 'Law 13-03 on combating air pollution',
      },
      articles: [
        {
          article_id: 'env_air_13_03_4',
          code: { fr: 'Article 4', en: 'Article 4' },
          text: {
            fr: "Il est interdit de dégager, d'émettre ou de rejeter, de permettre le dégagement, l'émission ou le rejet dans l'air de polluants tels que les gaz toxiques ou corrosifs, les fumées, les vapeurs, la chaleur, les poussières, les odeurs au-delà de la quantité ou de la concentration autorisées par les normes fixées par voie réglementaire.\nToute personne, est tenue de prévenir, de réduire et de limiter les émissions de polluants dans l'air susceptibles de porter atteinte à la santé de l'homme, à la faune, à la flore, aux monuments et aux sites ou ayant des effets nocifs sur l'environnement en général et ce, conformément aux normes visées à l'alinéa précédent.\nEn l'absence de normes fixées par voie réglementaire, les exploitants des installations prévues à l'article 2 (alinéa 1) sont tenus d'appliquer les techniques disponibles et plus avancées afin de prévenir ou de réduire les émissions.",
            en: "Il est interdit de dégager, d'émettre ou de rejeter, de permettre le dégagement, l'émission ou le rejet dans l'air de polluants tels que les gaz toxiques ou corrosifs, les fumées, les vapeurs, la chaleur, les poussières, les odeurs au-delà de la quantité ou de la concentration autorisées par les normes fixées par voie réglementaire.\nToute personne, est tenue de prévenir, de réduire et de limiter les émissions de polluants dans l'air susceptibles de porter atteinte à la santé de l'homme, à la faune, à la flore, aux monuments et aux sites ou ayant des effets nocifs sur l'environnement en général et ce, conformément aux normes visées à l'alinéa précédent.\nEn l'absence de normes fixées par voie réglementaire, les exploitants des installations prévues à l'article 2 (alinéa 1) sont tenus d'appliquer les techniques disponibles et plus avancées afin de prévenir ou de réduire les émissions.",
          },
        },
        {
          article_id: 'env_air_decret_2_09_631',
          code: { fr: 'Décret n° 2-09-631', en: 'Decree 2-09-631' },
          text: {
            fr: 'Décret n° 2-09-631 fixant les valeurs limites de dégagement, d\'émission ou de rejet de polluants dans l\'air émanant de sources de pollution fixes et les modalités de leur contrôle',
            en: 'Décret n° 2-09-631 fixant les valeurs limites de dégagement, d\'émission ou de rejet de polluants dans l\'air émanant de sources de pollution fixes et les modalités de leur contrôle',
          },
        },
        {
          article_id: 'env_air_13_03_8',
          code: { fr: 'Article 8', en: 'Article 8' },
          text: {
            fr: "Toute personne responsable d'un incident grave dû à l'un des polluants visés à l'article 4 ci-dessus, doit en aviser immédiatement l'autorité locale et les autorités compétentes en fournissant à celles-ci toutes informations sur les circonstances de la pollution.",
            en: "Toute personne responsable d'un incident grave dû à l'un des polluants visés à l'article 4 ci-dessus, doit en aviser immédiatement l'autorité locale et les autorités compétentes en fournissant à celles-ci toutes informations sur les circonstances de la pollution.",
          },
        },
      ],
    },
    {
      chapter_id: 'code_route',
      title: {
        fr: 'Loi n°52-05 portant code de la route',
        en: 'Road Code Law 52-05',
      },
      articles: [
        {
          article_id: 'env_air_code_route_67',
          code: { fr: 'Article 67', en: 'Article 67' },
          text: {
            fr: "1- Les véhicules à moteur ne doivent pas émettre de fumées, de gaz toxique, corrosifs ou odorants, dans des conditions susceptibles d'incommoder la population, de compromettre la santé et la sécurité publiques ou de porter préjudice à l'environnement.\n\n2- Les moteurs des véhicules ne doivent pas émettre de bruits susceptibles de causer une gêne aux usagers de la route ou aux riverains.\nLe moteur doit être muni d'un dispositif d'échappement silencieux en bon état de fonctionnement sans possibilité d'interruption par le conducteur.\nToute opération tendant à supprimer ou à réduire l'efficacité du dispositif d'échappement silencieux est interdite.",
            en: "1- Les véhicules à moteur ne doivent pas émettre de fumées, de gaz toxique, corrosifs ou odorants, dans des conditions susceptibles d'incommoder la population, de compromettre la santé et la sécurité publiques ou de porter préjudice à l'environnement.\n\n2- Les moteurs des véhicules ne doivent pas émettre de bruits susceptibles de causer une gêne aux usagers de la route ou aux riverains.\nLe moteur doit être muni d'un dispositif d'échappement silencieux en bon état de fonctionnement sans possibilité d'interruption par le conducteur.\nToute opération tendant à supprimer ou à réduire l'efficacité du dispositif d'échappement silencieux est interdite.",
          },
        },
        {
          article_id: 'env_air_decret_2_97_377',
          code: { fr: 'Décret n° 2-97-377', en: 'Decree 2-97-377' },
          text: {
            fr: "Décret n° 2-97-377 sur la police de la circulation et du roulage:\n1- Les véhicules automobiles fonctionnant à l'essence ou au gazoil - à l'exception des véhicules spéciaux des travaux publics dont la liste est fixée par voie réglementaire - doivent être conçus, construits, réglés, entretenus, alimentés, utilisés et conduits de façon à ne pas provoquer d'émission de fumée ou de gaz dépassant les valeurs de 4,5% de monoxyde de carbone et de 70% d'opacité.\n2- Il est interdit, sauf cas de nécessité dûment justifié, de laisser en état de marche le moteur d'un véhicule en stationnement.",
            en: "Décret n° 2-97-377 sur la police de la circulation et du roulage:\n1- Les véhicules automobiles fonctionnant à l'essence ou au gazoil - à l'exception des véhicules spéciaux des travaux publics dont la liste est fixée par voie réglementaire - doivent être conçus, construits, réglés, entretenus, alimentés, utilisés et conduits de façon à ne pas provoquer d'émission de fumée ou de gaz dépassant les valeurs de 4,5% de monoxyde de carbone et de 70% d'opacité.\n2- Il est interdit, sauf cas de nécessité dûment justifié, de laisser en état de marche le moteur d'un véhicule en stationnement.",
          },
        },
      ],
    },
  ],
}

export const SECTION_ENV_EAU = {
  section_id: 'env_eau',
  title: {
    fr: '5. Eau',
    en: '5. Water',
  },
  chapters: [
    {
      chapter_id: 'dph_conditions_generales',
      title: {
        fr: 'Conditions Générales relatives au domaine public hydraulique',
        en: 'General conditions related to the hydraulic public domain',
      },
      articles: [
        {
          article_id: 'env_eau_12a',
          code: { fr: 'Article 12 a', en: 'Article 12 a' },
          text: {
            fr: "Interdictions:\n1 - d'anticiper de quelque manière que ce soit, notamment par des constructions, sur les limites des francs-bords des cours d'eau temporaires ou permanents, des séguias, des lacs, des sources ainsi que sur les limites d'emprises des aqueducs, des conduites d'eau, des canaux de navigation, d'irrigation ou d'assainissement faisant partie du domaine public hydraulique ;\n2 - de placer à l'intérieur des limites du domaine public hydraulique tous obstacles entravant la navigation, le libre écoulement des eaux et la libre circulation sur les francs-bords ;\n3 - de jeter dans le lit des cours d'eau des objets susceptibles d'embarrasser ce lit ou y provoquer des atterrissements ;\n4 - de traverser les séguias, conduites, aqueducs ou canalisations à ciel ouvert inclus dans le domaine public hydraulique, avec des véhicules ou animaux, en dehors des passages spécialement réservés à cet effet, et de laisser pénétrer les bestiaux dans les emprises des canaux d'irrigation ou d'assainissement. Les points où les troupeaux pourront exceptionnellement accéder à ces canaux pour s'y abreuver sont fixés par l'agence de bassin.",
            en: "Interdictions:\n1 - d'anticiper de quelque manière que ce soit, notamment par des constructions, sur les limites des francs-bords des cours d'eau temporaires ou permanents, des séguias, des lacs, des sources ainsi que sur les limites d'emprises des aqueducs, des conduites d'eau, des canaux de navigation, d'irrigation ou d'assainissement faisant partie du domaine public hydraulique ;\n2 - de placer à l'intérieur des limites du domaine public hydraulique tous obstacles entravant la navigation, le libre écoulement des eaux et la libre circulation sur les francs-bords ;\n3 - de jeter dans le lit des cours d'eau des objets susceptibles d'embarrasser ce lit ou y provoquer des atterrissements ;\n4 - de traverser les séguias, conduites, aqueducs ou canalisations à ciel ouvert inclus dans le domaine public hydraulique, avec des véhicules ou animaux, en dehors des passages spécialement réservés à cet effet, et de laisser pénétrer les bestiaux dans les emprises des canaux d'irrigation ou d'assainissement. Les points où les troupeaux pourront exceptionnellement accéder à ces canaux pour s'y abreuver sont fixés par l'agence de bassin.",
          },
        },
        {
          article_id: 'env_eau_12b',
          code: { fr: 'Article 12 b', en: 'Article 12 b' },
          text: {
            fr: "Interdictions sauf autorisation préalable délivrée suivant des modalités fixées par voie réglementaire :\n1 - d'effectuer ou enlever tout dépôt, toute plantation ou culture dans le domaine public hydraulique,\n2 - de curer, approfondir, élargir, redresser ou régulariser les cours d'eau temporaires ou permanents,\n3 - de pratiquer sur les ouvrages publics, les cours d'eau et toute autre partie du domaine public hydraulique des saignées ou prises d'eau,\n4 - d'effectuer des excavations de quelque nature que ce soit, notamment des extractions de matériaux de construction, dans les lits des cours d'eau, à une distance inférieure à 10 mètres de la limite des francs-bords des cours d'eau, ou de l'emprise des conduites, aqueducs et canaux. L'autorisation n'est pas accordée lorsque ces excavations sont de nature à porter préjudice aux ouvrages publics, à la stabilité des berges des cours d'eau ou à la faune aquatique.",
            en: "Interdictions sauf autorisation préalable délivrée suivant des modalités fixées par voie réglementaire :\n1 - d'effectuer ou enlever tout dépôt, toute plantation ou culture dans le domaine public hydraulique,\n2 - de curer, approfondir, élargir, redresser ou régulariser les cours d'eau temporaires ou permanents,\n3 - de pratiquer sur les ouvrages publics, les cours d'eau et toute autre partie du domaine public hydraulique des saignées ou prises d'eau,\n4 - d'effectuer des excavations de quelque nature que ce soit, notamment des extractions de matériaux de construction, dans les lits des cours d'eau, à une distance inférieure à 10 mètres de la limite des francs-bords des cours d'eau, ou de l'emprise des conduites, aqueducs et canaux. L'autorisation n'est pas accordée lorsque ces excavations sont de nature à porter préjudice aux ouvrages publics, à la stabilité des berges des cours d'eau ou à la faune aquatique.",
          },
        },
        {
          article_id: 'env_eau_25',
          code: { fr: 'Article 25', en: 'Article 25' },
          text: {
            fr: "Les propriétaires ont le droit d'user des eaux pluviales tombées sur leurs fonds.\nLes conditions d'accumulation artificielle des eaux sur les propriétés privées sont fixées par voie réglementaire.",
            en: "Les propriétaires ont le droit d'user des eaux pluviales tombées sur leurs fonds.\nLes conditions d'accumulation artificielle des eaux sur les propriétés privées sont fixées par voie réglementaire.",
          },
        },
        {
          article_id: 'env_eau_decret_2_97_224',
          code: { fr: 'Décret n° 2-97-224', en: 'Decree 2-97-224' },
          text: {
            fr: "Décret n° 2-97-224 fixant les conditions d'accumulation artificielle des eaux.\nL'accumulation artificielle des eaux prévue au 2e alinéa de l'article 25 de la loi n° 10-95, est soumise à autorisation délivrée par le directeur de l'agence du bassin hydraulique concernée dans les conditions fixées par le présent décret.\n\nToutefois, les ouvrages d'accumulation artificielle des eaux d'un volume inférieur à deux mille (2000) mètres cubes d'eaux sont soumis à une simple déclaration.",
            en: "Décret n° 2-97-224 fixant les conditions d'accumulation artificielle des eaux.\nL'accumulation artificielle des eaux prévue au 2e alinéa de l'article 25 de la loi n° 10-95, est soumise à autorisation délivrée par le directeur de l'agence du bassin hydraulique concernée dans les conditions fixées par le présent décret.\n\nToutefois, les ouvrages d'accumulation artificielle des eaux d'un volume inférieur à deux mille (2000) mètres cubes d'eaux sont soumis à une simple déclaration.",
          },
        },
        {
          article_id: 'env_eau_26',
          code: { fr: 'Article 26', en: 'Article 26' },
          text: {
            fr: "Sous réserve des dispositions des articles 36 et suivants de la présente loi, tout propriétaire peut, sans autorisation, creuser sur son fonds des puits ou y réaliser des forages d'une profondeur ne dépassant pas le seuil fixé par voie réglementaire. Il a droit à l'usage des eaux, sous réserve des droits des tiers et des conditions de la présente loi.",
            en: "Sous réserve des dispositions des articles 36 et suivants de la présente loi, tout propriétaire peut, sans autorisation, creuser sur son fonds des puits ou y réaliser des forages d'une profondeur ne dépassant pas le seuil fixé par voie réglementaire. Il a droit à l'usage des eaux, sous réserve des droits des tiers et des conditions de la présente loi.",
          },
        },
      ],
    },
    {
      chapter_id: 'abh_decrets',
      title: {
        fr: 'Décrets et Arrêtés des ABH susvisés',
        en: 'ABH decrees and orders',
      },
      articles: [
        {
          article_id: 'env_eau_37',
          code: { fr: 'Article 37', en: 'Article 37' },
          text: {
            fr: "Toute personne physique ou morale utilisant les eaux du domaine public hydraulique est soumise au paiement d'une redevance pour utilisation de l'eau, dans les conditions fixées dans la présente loi.\nLes modalités de fixation et de recouvrement de cette redevance sont fixées par voie réglementaire.",
            en: "Toute personne physique ou morale utilisant les eaux du domaine public hydraulique est soumise au paiement d'une redevance pour utilisation de l'eau, dans les conditions fixées dans la présente loi.\nLes modalités de fixation et de recouvrement de cette redevance sont fixées par voie réglementaire.",
          },
        },
        {
          article_id: 'env_eau_38',
          code: { fr: 'Article 38', en: 'Article 38' },
          text: {
            fr: "Sont soumis au régime de l'autorisation :\n1 - les travaux de recherche, sous réserve des dispositions de l'article 26 ci-dessus, de captage d'eaux souterraines ou jaillissantes ;\n2 - le creusement de puits et la réalisation de forages d'une profondeur dépassant le seuil visé à l'article 26 ci-dessus ;\n3 - les travaux de captage et l'utilisation des eaux de sources naturelles situées sur les propriétés privées ;\n4 - l'établissement, pour une période n'excédant pas une durée de cinq ans renouvelable, d'ouvrages ayant pour but l'utilisation des eaux du domaine public hydraulique, tels que moulins à eau, digues, barrages ou canaux, sous réserve que ces ouvrages n'entravent pas le libre écoulement des eaux et la libre circulation sur les francs-bords et qu'ils n'entraînent pas la pollution des eaux ;\n5 - les prélèvements de débits d'eau dans la nappe souterraine, quelle qu'en soit la nature, supérieurs à un seuil fixé par voie réglementaire ;\n6 - les prises d'eau établies sur les cours d'eau ou canaux dérivés des oueds ;\n7 - le prélèvement d'eau de toute nature en vue de sa vente ou de son usage thérapeutique ;\n8 - l'exploitation des bacs ou passages sur les cours d'eau.",
            en: "Sont soumis au régime de l'autorisation :\n1 - les travaux de recherche, sous réserve des dispositions de l'article 26 ci-dessus, de captage d'eaux souterraines ou jaillissantes ;\n2 - le creusement de puits et la réalisation de forages d'une profondeur dépassant le seuil visé à l'article 26 ci-dessus ;\n3 - les travaux de captage et l'utilisation des eaux de sources naturelles situées sur les propriétés privées ;\n4 - l'établissement, pour une période n'excédant pas une durée de cinq ans renouvelable, d'ouvrages ayant pour but l'utilisation des eaux du domaine public hydraulique, tels que moulins à eau, digues, barrages ou canaux, sous réserve que ces ouvrages n'entravent pas le libre écoulement des eaux et la libre circulation sur les francs-bords et qu'ils n'entraînent pas la pollution des eaux ;\n5 - les prélèvements de débits d'eau dans la nappe souterraine, quelle qu'en soit la nature, supérieurs à un seuil fixé par voie réglementaire ;\n6 - les prises d'eau établies sur les cours d'eau ou canaux dérivés des oueds ;\n7 - le prélèvement d'eau de toute nature en vue de sa vente ou de son usage thérapeutique ;\n8 - l'exploitation des bacs ou passages sur les cours d'eau.",
          },
        },
      ],
    },
    {
      chapter_id: 'pollution_eaux',
      title: {
        fr: 'Lutte contre la pollution des eaux',
        en: 'Combating water pollution',
      },
      articles: [
        {
          article_id: 'env_eau_52',
          code: { fr: 'Article 52', en: 'Article 52' },
          text: {
            fr: "Aucun déversement, écoulement, rejet, dépôt direct ou indirect dans une eau superficielle ou une nappe souterraine, ne peut être fait sans autorisation préalable accordée, après enquête, par l'agence de bassin.\nL'enquête publique ne peut excéder 30 jours.\nCette autorisation donne lieu au paiement de redevances dans les conditions fixées par voie réglementaire\nLe recouvrement des redevances peut être poursuivi, dans les conditions fixées par voie réglementaire, tant auprès du propriétaire des installations de déversement, écoulement, rejet, dépôt direct ou indirect, qu'auprès de l'exploitant desdites installations, qui sont conjointement et solidairement responsables du paiement de celles-ci.",
            en: "Aucun déversement, écoulement, rejet, dépôt direct ou indirect dans une eau superficielle ou une nappe souterraine, ne peut être fait sans autorisation préalable accordée, après enquête, par l'agence de bassin.\nL'enquête publique ne peut excéder 30 jours.\nCette autorisation donne lieu au paiement de redevances dans les conditions fixées par voie réglementaire\nLe recouvrement des redevances peut être poursuivi, dans les conditions fixées par voie réglementaire, tant auprès du propriétaire des installations de déversement, écoulement, rejet, dépôt direct ou indirect, qu'auprès de l'exploitant desdites installations, qui sont conjointement et solidairement responsables du paiement de celles-ci.",
          },
        },
        {
          article_id: 'env_eau_54',
          code: { fr: 'Article 54', en: 'Article 54' },
          text: {
            fr: "Il est interdit :\n1 - de rejeter des eaux usées ou des déchets solides dans les oueds à sec, dans les puits, abreuvoirs et lavoirs publics, forages, canaux ou galeries de captage des eaux. Seule est admise l'évacuation des eaux résiduaires ou usées domestiques dans des puits filtrants précédés d'une fosse septique ;\n2 - d'effectuer tout épandage ou enfouissement d'effluents et tout dépôt de déchets susceptibles de polluer par infiltration les eaux souterraines ou par ruissellement les eaux de surface ;\n3 - de laver du linge et autres objets, notamment des viandes, peaux ou produits animaux dans les eaux de séguias, conduites, aqueducs, canalisations, réservoirs, puits qui alimentent les villes, agglomérations, lieux publics et à l'intérieur des zones de protection de ces mêmes séguias, conduites, aqueducs, canalisations, réservoirs, puits ;\n4 - de se baigner et de se laver dans lesdits ouvrages, ou d'y abreuver les animaux, les y laver ou baigner ;\n5 - de déposer des matières insalubres, d'installer des fosses d'aisance ou des puisards à l'intérieur des zones de protection desdits séguias, conduites, aqueducs, canalisations, réservoirs et puits ;\n6 - de jeter des bêtes mortes dans les cours d'eau, lacs, étangs, marais et de les enterrer à proximité des puits, fontaines et abreuvoirs publics ;\n7 - de jeter, à l'intérieur des périmètres urbains, des centres délimités et des agglomérations rurales dotées d'un plan de développement, toute eau usée ou toute matière nuisible à la santé publique en dehors dès lieux indiqués à cet effet ou dans des formes contraires à celles fixées par la présente loi et la réglementation en vigueur.",
            en: "Il est interdit :\n1 - de rejeter des eaux usées ou des déchets solides dans les oueds à sec, dans les puits, abreuvoirs et lavoirs publics, forages, canaux ou galeries de captage des eaux. Seule est admise l'évacuation des eaux résiduaires ou usées domestiques dans des puits filtrants précédés d'une fosse septique ;\n2 - d'effectuer tout épandage ou enfouissement d'effluents et tout dépôt de déchets susceptibles de polluer par infiltration les eaux souterraines ou par ruissellement les eaux de surface ;\n3 - de laver du linge et autres objets, notamment des viandes, peaux ou produits animaux dans les eaux de séguias, conduites, aqueducs, canalisations, réservoirs, puits qui alimentent les villes, agglomérations, lieux publics et à l'intérieur des zones de protection de ces mêmes séguias, conduites, aqueducs, canalisations, réservoirs, puits ;\n4 - de se baigner et de se laver dans lesdits ouvrages, ou d'y abreuver les animaux, les y laver ou baigner ;\n5 - de déposer des matières insalubres, d'installer des fosses d'aisance ou des puisards à l'intérieur des zones de protection desdits séguias, conduites, aqueducs, canalisations, réservoirs et puits ;\n6 - de jeter des bêtes mortes dans les cours d'eau, lacs, étangs, marais et de les enterrer à proximité des puits, fontaines et abreuvoirs publics ;\n7 - de jeter, à l'intérieur des périmètres urbains, des centres délimités et des agglomérations rurales dotées d'un plan de développement, toute eau usée ou toute matière nuisible à la santé publique en dehors dès lieux indiqués à cet effet ou dans des formes contraires à celles fixées par la présente loi et la réglementation en vigueur.",
          },
        },
        {
          article_id: 'env_eau_decrets_list',
          code: { fr: 'Décrets et arrêtés', en: 'Decrees and orders' },
          text: {
            fr: "Décret n° 2-04-553 relatif aux déversements, écoulements, rejets, dépôts directs ou indirects dans les eaux superficielles ou souterraines\nDécret n° 2-05-1533 relatif à l'assainissement autonome\nArrêté n° 1180-06 fixant les taux de redevances applicables aux déversements des eaux usées et définissant l'unité de pollution\nArrêté n°1606-06 portant fixation des valeurs limites spécifiques de rejet des industries de la pâte à papier, du papier et du carton\nArrêté n°1607-06 portant fixation des valeurs limites spécifiques de rejet domestique\nArrêté n°1608-06 du 25 juillet 2006 valeurs limites spécifiques de rejet des industries du sucre\nArrêté portant fixation des valeurs limites des rejets de raffineries de pétrole\nArrêté portant fixation des valeurs limites générales de rejet",
            en: "Décret n° 2-04-553 relatif aux déversements, écoulements, rejets, dépôts directs ou indirects dans les eaux superficielles ou souterraines\nDécret n° 2-05-1533 relatif à l'assainissement autonome\nArrêté n° 1180-06 fixant les taux de redevances applicables aux déversements des eaux usées et définissant l'unité de pollution\nArrêté n°1606-06 portant fixation des valeurs limites spécifiques de rejet des industries de la pâte à papier, du papier et du carton\nArrêté n°1607-06 portant fixation des valeurs limites spécifiques de rejet domestique\nArrêté n°1608-06 du 25 juillet 2006 valeurs limites spécifiques de rejet des industries du sucre\nArrêté portant fixation des valeurs limites des rejets de raffineries de pétrole\nArrêté portant fixation des valeurs limites générales de rejet",
          },
        },
      ],
    },
  ],
}

export const SECTION_ENV_DECHETS = {
  section_id: 'env_dechets',
  title: {
    fr: '6. Déchets',
    en: '6. Waste',
  },
  chapters: [
    {
      chapter_id: 'obligations_generales',
      title: {
        fr: 'Obligations générales',
        en: 'General obligations',
      },
      articles: [
        {
          article_id: 'env_dechets_4',
          code: { fr: 'Article 4', en: 'Article 4' },
          text: {
            fr: "1- Les produits conçus, fabriqués et importés par les générateurs des déchets doivent présenter des caractéristiques de manière à ce que, lors de leur cycle de vie, la quantité et la nocivité des déchets engendrés par ces produits soient réduites en utilisant la technique disponible économiquement viable et appropriée.\n2- Les générateurs des déchets sont tenus également de fournir à l'administration toutes les informations sur les caractéristiques des déchets qu'ils fabriquent, distribuent ou importent.\n3- Des conditions et des mesures peuvent être imposées à certains produits lors de leur fabrication ou leur importation ou leur distribution en vue de réduire la quantité et la nocivité des déchets issus de ces produits.\nLes modalités d'application des alinéas 2 et 3 de cet article sont fixées par voie réglementaire.",
            en: "1- Les produits conçus, fabriqués et importés par les générateurs des déchets doivent présenter des caractéristiques de manière à ce que, lors de leur cycle de vie, la quantité et la nocivité des déchets engendrés par ces produits soient réduites en utilisant la technique disponible économiquement viable et appropriée.\n2- Les générateurs des déchets sont tenus également de fournir à l'administration toutes les informations sur les caractéristiques des déchets qu'ils fabriquent, distribuent ou importent.\n3- Des conditions et des mesures peuvent être imposées à certains produits lors de leur fabrication ou leur importation ou leur distribution en vue de réduire la quantité et la nocivité des déchets issus de ces produits.\nLes modalités d'application des alinéas 2 et 3 de cet article sont fixées par voie réglementaire.",
          },
        },
        {
          article_id: 'env_dechets_5',
          code: { fr: 'Article 5', en: 'Article 5' },
          text: {
            fr: "L'utilisation de produits issus du recyclage des déchets dans la fabrication des produits destinés à être mis en contact direct avec les produits alimentaires est interdite.",
            en: "L'utilisation de produits issus du recyclage des déchets dans la fabrication des produits destinés à être mis en contact direct avec les produits alimentaires est interdite.",
          },
        },
        {
          article_id: 'env_dechets_6',
          code: { fr: 'Article 6', en: 'Article 6' },
          text: {
            fr: "Toute personne qui détient ou produit des déchets, dans des conditions de nature à produire des effets nocifs sur le sol, la faune et la flore, à dégrader les sites ou les paysages, à polluer l'air ou les eaux, à engendrer des odeurs, ou d'une façon générale, à porter atteinte à la santé de l'homme et à l'environnement, est tenue d'en assurer ou d'en faire assurer l'élimination dans les conditions propres à éviter lesdits effets, et ce, conformément aux dispositions de la présente loi et ses textes d'application.",
            en: "Toute personne qui détient ou produit des déchets, dans des conditions de nature à produire des effets nocifs sur le sol, la faune et la flore, à dégrader les sites ou les paysages, à polluer l'air ou les eaux, à engendrer des odeurs, ou d'une façon générale, à porter atteinte à la santé de l'homme et à l'environnement, est tenue d'en assurer ou d'en faire assurer l'élimination dans les conditions propres à éviter lesdits effets, et ce, conformément aux dispositions de la présente loi et ses textes d'application.",
          },
        },
        {
          article_id: 'env_dechets_7',
          code: { fr: 'Article 7', en: 'Article 7' },
          text: {
            fr: "L'incinération des déchets en plein air est interdite, à l'exception des déchets végétaux issus des jardins et du brûlis qui se pratique sur les chaumes dans les champs.\nL'élimination des déchets par incinération ne peut avoir lieu que dans des installations destinées à cet effet, conformément aux dispositions de l'article 52 de la présente loi et ses textes d'application.",
            en: "L'incinération des déchets en plein air est interdite, à l'exception des déchets végétaux issus des jardins et du brûlis qui se pratique sur les chaumes dans les champs.\nL'élimination des déchets par incinération ne peut avoir lieu que dans des installations destinées à cet effet, conformément aux dispositions de l'article 52 de la présente loi et ses textes d'application.",
          },
        },
        {
          article_id: 'env_dechets_8',
          code: { fr: 'Article 8', en: 'Article 8' },
          text: {
            fr: "Quiconque dépose des déchets en dehors des endroits désignés à cet effet, est tenu de les reprendre en vue de les éliminer conformément aux dispositions de la présente loi et ses textes d'application.\nLe président de la commune concernée, pour les déchets ménagers et assimilés, le wali de la région ou le gouverneur de la préfecture ou de la province, pour les autres déchets, peuvent, après mise en demeure, ordonner, aux frais du contrevenant, l'élimination d'office des déchets.\nDans le cas où le contrevenant n'a pu être identifié, l'autorité concernée ordonne l'élimination des déchets.",
            en: "Quiconque dépose des déchets en dehors des endroits désignés à cet effet, est tenu de les reprendre en vue de les éliminer conformément aux dispositions de la présente loi et ses textes d'application.\nLe président de la commune concernée, pour les déchets ménagers et assimilés, le wali de la région ou le gouverneur de la préfecture ou de la province, pour les autres déchets, peuvent, après mise en demeure, ordonner, aux frais du contrevenant, l'élimination d'office des déchets.\nDans le cas où le contrevenant n'a pu être identifié, l'autorité concernée ordonne l'élimination des déchets.",
          },
        },
      ],
    },
    {
      chapter_id: 'dechets_menagers',
      title: {
        fr: 'Gestion des déchets ménagers et assimilés',
        en: 'Household waste management',
      },
      articles: [
        {
          article_id: 'env_dechets_21',
          code: { fr: 'Article 21', en: 'Article 21' },
          text: {
            fr: "Tout détenteur des déchets ménagers et assimilés est tenu de se conformer au règlement de la précollecte prévu par le plan communal ou intercommunal et d'utiliser le système de gestion de ces déchets mis en place par les communes et leurs groupements ou par les exploitants.\nLes communes, leurs groupements ou les exploitants prennent obligatoirement en charge les dépenses afférentes aux opérations de collecte, de transport, de mise en décharge contrôlée, d'élimination, de valorisation des déchets ménagers et assimilés et, le cas échéant, de tri de ces déchets ainsi que les dépenses de contrôle de la propreté des zones où ce service est assuré directement par les générateurs de ces déchets.",
            en: "Tout détenteur des déchets ménagers et assimilés est tenu de se conformer au règlement de la précollecte prévu par le plan communal ou intercommunal et d'utiliser le système de gestion de ces déchets mis en place par les communes et leurs groupements ou par les exploitants.\nLes communes, leurs groupements ou les exploitants prennent obligatoirement en charge les dépenses afférentes aux opérations de collecte, de transport, de mise en décharge contrôlée, d'élimination, de valorisation des déchets ménagers et assimilés et, le cas échéant, de tri de ces déchets ainsi que les dépenses de contrôle de la propreté des zones où ce service est assuré directement par les générateurs de ces déchets.",
          },
        },
      ],
    },
    {
      chapter_id: 'dechets_inertes',
      title: {
        fr: 'Gestion des déchets inertes, déchets agricoles, déchets ultimes et déchets industriels non dangereux',
        en: 'Inert/agricultural/ultimate/non-hazardous industrial waste management',
      },
      articles: [
        {
          article_id: 'env_dechets_24',
          code: { fr: 'Article 24', en: 'Article 24' },
          text: {
            fr: "Les déchets inertes, les déchets ultimes, les déchets agricoles et les déchets industriels non dangereux doivent être déposés par leurs générateurs ou par les personnes autorisées à les gérer dans les lieux et les installations d'élimination désignés à cette fin par le plan directeur régional sous le contrôle des communes ou de leurs groupements concernés ainsi que des agents commissionnés à cet effet.",
            en: "Les déchets inertes, les déchets ultimes, les déchets agricoles et les déchets industriels non dangereux doivent être déposés par leurs générateurs ou par les personnes autorisées à les gérer dans les lieux et les installations d'élimination désignés à cette fin par le plan directeur régional sous le contrôle des communes ou de leurs groupements concernés ainsi que des agents commissionnés à cet effet.",
          },
        },
      ],
    },
    {
      chapter_id: 'dechets_dangereux',
      title: {
        fr: 'Gestion des déchets dangereux',
        en: 'Hazardous waste management',
      },
      articles: [
        {
          article_id: 'env_dechets_29',
          code: { fr: 'Article 29', en: 'Article 29' },
          text: {
            fr: "Les déchets dangereux ne peuvent être traités en vue de leur élimination ou de leur valorisation que dans des installations spécialisées désignées par l'administration et autorisées conformément au plan directeur national de gestion des déchets dangereux et aux dispositions de la présente loi et ses textes d'application.\nLes générateurs et les détenteurs de déchets dangereux doivent déposer lesdits déchets dans les installations visées au 1er alinéa ci-dessus.\nLa liste des déchets dangereux est fixée par voie réglementaire.",
            en: "Les déchets dangereux ne peuvent être traités en vue de leur élimination ou de leur valorisation que dans des installations spécialisées désignées par l'administration et autorisées conformément au plan directeur national de gestion des déchets dangereux et aux dispositions de la présente loi et ses textes d'application.\nLes générateurs et les détenteurs de déchets dangereux doivent déposer lesdits déchets dans les installations visées au 1er alinéa ci-dessus.\nLa liste des déchets dangereux est fixée par voie réglementaire.",
          },
        },
        {
          article_id: 'env_dechets_decret_2_07_253',
          code: { fr: 'Décret n° 2-07-253', en: 'Decree 2-07-253' },
          text: {
            fr: 'Décret n° 2-07-253 portant classification des déchets et fixant la liste des déchets dangereux.',
            en: 'Décret n° 2-07-253 portant classification des déchets et fixant la liste des déchets dangereux.',
          },
        },
        {
          article_id: 'env_dechets_30_32',
          code: { fr: 'Article 30, 31 et 32', en: 'Articles 30, 31 & 32' },
          text: {
            fr: "1- La collecte et le transport des déchets dangereux sont soumis à une autorisation de l'administration\n2- Le transport des déchets dangereux à partir du site de production ne peut être effectué que si les emballages et les conteneurs nécessaires à leur transport portent des étiquettes identifiant clairement et visiblement ces déchets, et ce, conformément aux normes en vigueur.\n3- Le transport des déchets dangereux doit être accompagné d'un bordereau de suivi comportant les informations concernant l'expéditeur, le transporteur, le destinataire, la nature et la quantité des déchets, le mode de transport et les modalités de leur élimination.",
            en: "1- La collecte et le transport des déchets dangereux sont soumis à une autorisation de l'administration\n2- Le transport des déchets dangereux à partir du site de production ne peut être effectué que si les emballages et les conteneurs nécessaires à leur transport portent des étiquettes identifiant clairement et visiblement ces déchets, et ce, conformément aux normes en vigueur.\n3- Le transport des déchets dangereux doit être accompagné d'un bordereau de suivi comportant les informations concernant l'expéditeur, le transporteur, le destinataire, la nature et la quantité des déchets, le mode de transport et les modalités de leur élimination.",
          },
        },
        {
          article_id: 'env_dechets_33',
          code: { fr: 'Article 33', en: 'Article 33' },
          text: {
            fr: "Il est interdit d'enfouir les déchets dangereux, de les jeter, de les stocker ou de les déposer dans des lieux autres que les installations qui leur sont réservées conformément aux dispositions de la présente loi et ses textes d'application.",
            en: "Il est interdit d'enfouir les déchets dangereux, de les jeter, de les stocker ou de les déposer dans des lieux autres que les installations qui leur sont réservées conformément aux dispositions de la présente loi et ses textes d'application.",
          },
        },
        {
          article_id: 'env_dechets_35',
          code: { fr: 'Article 35', en: 'Article 35' },
          text: {
            fr: "Lors des opérations de collecte, de transport, de stockage, de valorisation, d'élimination ou de mise en décharge, les déchets dangereux ne peuvent être mélangés avec les autres catégories de déchets.\nToutefois, l'administration peut accorder une autorisation dérogatoire aux installations concernées lorsque le mélange des déchets dangereux avec d'autres déchets est nécessaire à la valorisation, au traitement ou à l'élimination de ces déchets.\nLes modalités d'octroi de ladite autorisation sont fixées par voie réglementaire.",
            en: "Lors des opérations de collecte, de transport, de stockage, de valorisation, d'élimination ou de mise en décharge, les déchets dangereux ne peuvent être mélangés avec les autres catégories de déchets.\nToutefois, l'administration peut accorder une autorisation dérogatoire aux installations concernées lorsque le mélange des déchets dangereux avec d'autres déchets est nécessaire à la valorisation, au traitement ou à l'élimination de ces déchets.\nLes modalités d'octroi de ladite autorisation sont fixées par voie réglementaire.",
          },
        },
        {
          article_id: 'env_dechets_36',
          code: { fr: 'Article 36', en: 'Article 36' },
          text: {
            fr: "Toute personne physique ou morale qui produit, collecte, transporte, stocke ou élimine les déchets dangereux doit disposer d'un contrat d'assurance couvrant sa responsabilité professionnelle.",
            en: "Toute personne physique ou morale qui produit, collecte, transporte, stocke ou élimine les déchets dangereux doit disposer d'un contrat d'assurance couvrant sa responsabilité professionnelle.",
          },
        },
        {
          article_id: 'env_dechets_37',
          code: { fr: 'Article 37', en: 'Article 37' },
          text: {
            fr: "Les générateurs des déchets dangereux et les personnes détenant les autorisations prévues aux articles 30 et 35 ci-dessus tiennent un registre dans lequel ils consignent les quantités, le type, la nature et l'origine des déchets dangereux qu'ils ont produits, collectés, stockés, transportés, récupérés ou éliminés, et communiquent chaque année à l'administration les renseignements de ce type correspondant à l'année écoulée.\nCe registre est soumis à l'inspection de l'administration.",
            en: "Les générateurs des déchets dangereux et les personnes détenant les autorisations prévues aux articles 30 et 35 ci-dessus tiennent un registre dans lequel ils consignent les quantités, le type, la nature et l'origine des déchets dangereux qu'ils ont produits, collectés, stockés, transportés, récupérés ou éliminés, et communiquent chaque année à l'administration les renseignements de ce type correspondant à l'année écoulée.\nCe registre est soumis à l'inspection de l'administration.",
          },
        },
        {
          article_id: 'env_dechets_decrets_dangereux',
          code: { fr: 'Décrets et arrêtés', en: 'Decrees and orders' },
          text: {
            fr: "Décret n° 2-09-85 relatif à la collecte, au transport et au traitement de certaines huiles usagées.\nDécret n°2-14-85 relatif à la gestion des déchets dangereux\nArrêté n° 2850-15 fixant les prescriptions particulières relatives à la collecte et à la valorisation des batteries usagées\nArrêté n° 3184-15 relatif à la gestion des déchets dangereux",
            en: "Décret n° 2-09-85 relatif à la collecte, au transport et au traitement de certaines huiles usagées.\nDécret n°2-14-85 relatif à la gestion des déchets dangereux\nArrêté n° 2850-15 fixant les prescriptions particulières relatives à la collecte et à la valorisation des batteries usagées\nArrêté n° 3184-15 relatif à la gestion des déchets dangereux",
          },
        },
      ],
    },
    {
      chapter_id: 'dechets_medicaux',
      title: {
        fr: 'Gestion des déchets médicaux et pharmaceutiques',
        en: 'Medical and pharmaceutical waste management',
      },
      articles: [
        {
          article_id: 'env_dechets_38',
          code: { fr: 'Article 38', en: 'Article 38' },
          text: {
            fr: "Les déchets médicaux et pharmaceutiques doivent faire l'objet d'une gestion spécifique visant à éviter toute atteinte à la santé de l'homme et à l'environnement.\nToutefois, certains types des déchets générés par les établissements de soin peuvent être assimilés aux déchets ménagers sur la base d'un rapport d'analyse, exigé par la commune et établi par un laboratoire agréé, à condition que ces déchets soient triés au préalable et ne soient pas contaminés par les déchets dangereux.\nLes modalités de gestion des déchets médicaux et pharmaceutiques sont fixées par voie réglementaire.",
            en: "Les déchets médicaux et pharmaceutiques doivent faire l'objet d'une gestion spécifique visant à éviter toute atteinte à la santé de l'homme et à l'environnement.\nToutefois, certains types des déchets générés par les établissements de soin peuvent être assimilés aux déchets ménagers sur la base d'un rapport d'analyse, exigé par la commune et établi par un laboratoire agréé, à condition que ces déchets soient triés au préalable et ne soient pas contaminés par les déchets dangereux.\nLes modalités de gestion des déchets médicaux et pharmaceutiques sont fixées par voie réglementaire.",
          },
        },
        {
          article_id: 'env_dechets_decret_2_09_139',
          code: { fr: 'Décret n°2-09-139', en: 'Decree 2-09-139' },
          text: {
            fr: 'Décret n°2-09-139 relatif à la gestion des déchets médicaux et pharmaceutiques',
            en: 'Décret n°2-09-139 relatif à la gestion des déchets médicaux et pharmaceutiques',
          },
        },
        {
          article_id: 'env_dechets_39',
          code: { fr: 'Article 39', en: 'Article 39' },
          text: {
            fr: "Le rejet, le stockage, le traitement, l'élimination ou l'incinération des déchets médicaux et pharmaceutiques sont interdits en dehors des endroits désignés par les plans directeurs régionaux.",
            en: "Le rejet, le stockage, le traitement, l'élimination ou l'incinération des déchets médicaux et pharmaceutiques sont interdits en dehors des endroits désignés par les plans directeurs régionaux.",
          },
        },
        {
          article_id: 'env_dechets_40',
          code: { fr: 'Article 40', en: 'Article 40' },
          text: {
            fr: "La collecte et le transport des déchets médicaux et pharmaceutiques sont soumis à une autorisation délivrée par l'administration pour une période maximale de cinq (5) ans renouvelable.\nL'octroi de cette autorisation est subordonné aux conditions précisées à l'article 30 ci-dessus.\nLes conditions et les modalités de délivrance de cette autorisation sont fixées par voie réglementaire.",
            en: "La collecte et le transport des déchets médicaux et pharmaceutiques sont soumis à une autorisation délivrée par l'administration pour une période maximale de cinq (5) ans renouvelable.\nL'octroi de cette autorisation est subordonné aux conditions précisées à l'article 30 ci-dessus.\nLes conditions et les modalités de délivrance de cette autorisation sont fixées par voie réglementaire.",
          },
        },
      ],
    },
  ],
}

export const SECTIONS = [
  SECTION_ENV_CHARTE,
  SECTION_ENV_EIID,
  SECTION_ENV_EIE,
  SECTION_ENV_AIR,
  SECTION_ENV_EAU,
  SECTION_ENV_DECHETS,
]

export const FLAT_ARTICLES = SECTIONS.flatMap((section) =>
  (section.chapters ?? []).flatMap((chapter) =>
    (chapter.articles ?? []).map((a) => ({ ...a, section_id: section.section_id, chapter_id: chapter.chapter_id }))
  )
)

export const makeInitialAnswers = ({ previousNonApplicableArticleIds = [] } = {}) => {
  const previousSet = new Set(previousNonApplicableArticleIds)

  return {
    sections: [
      ...SECTIONS.map((section) => {
        const flat = FLAT_ARTICLES.filter((a) => a.section_id === section.section_id)
        return {
          section_id: section.section_id,
          articles: flat.map((a) => ({
            article_id: a.article_id,
            chapter_id: a.chapter_id,
            applicable: !previousSet.has(a.article_id),
            compliant: true,
            corrective_action: '',
            comment: '',
          })),
        }
      }),
    ],
  }
}

export { getLocalized, formatBulletText }

export const getArticleSchemaById = (articleId) => {
  return FLAT_ARTICLES.find((a) => a.article_id === articleId) ?? null
}

export const getSectionSchemaById = (sectionId) => {
  return SECTIONS.find((s) => s.section_id === sectionId) ?? null
}
