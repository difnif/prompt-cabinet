// 미드저니 프롬프트 자동 분류용 키워드 사전
// 카테고리 ID → { label, prefix, keywords }
//
// 정책:
// - 주제 카테고리(animal/food/...)가 modifier 카테고리(artstyle/emotion)보다 우선
// - 단어 경계 매칭(영어) + 단순 포함 매칭(한국어/멀티워드)
// - 정확 매칭 +2점, 그 외 0점

export const CATEGORIES = {
  // ── 주제 카테고리 ──────────────────────────
  animal: {
    label: '동물',
    prefix: '동',
    keywords: [
      // 포유류 (반려/육상)
      'cat', 'kitten', 'kitty', 'feline',
      'dog', 'puppy', 'doggy', 'canine', 'pup',
      'rabbit', 'bunny', 'hare',
      'fox', 'wolf', 'coyote',
      'bear', 'panda', 'koala',
      'tiger', 'lion', 'leopard', 'cheetah', 'jaguar',
      'elephant', 'rhino', 'hippo',
      'horse', 'pony', 'foal',
      'cow', 'bull', 'buffalo', 'ox',
      'sheep', 'goat', 'lamb',
      'pig', 'piglet',
      'mouse', 'rat', 'hamster',
      'squirrel', 'chipmunk',
      'monkey', 'ape', 'gorilla', 'chimp',
      'deer', 'reindeer', 'moose', 'elk',
      'hedgehog', 'porcupine',
      'raccoon', 'skunk', 'otter', 'beaver',
      'bat',
      // 조류
      'bird', 'sparrow', 'robin', 'crow', 'raven',
      'owl', 'eagle', 'hawk', 'falcon',
      'parrot', 'cockatoo', 'macaw',
      'penguin', 'flamingo', 'peacock',
      'duck', 'goose', 'swan',
      'chicken', 'rooster', 'hen', 'chick',
      // 어류 / 수생
      'fish', 'goldfish', 'koi',
      'whale', 'dolphin', 'shark', 'octopus', 'squid', 'jellyfish',
      'turtle', 'tortoise',
      'crab', 'lobster', 'shrimp',
      'seal', 'walrus',
      // 곤충/소형
      'butterfly', 'moth', 'bee', 'bumblebee',
      'spider', 'ant', 'beetle', 'ladybug', 'ladybird',
      'dragonfly', 'firefly', 'snail',
      // 파충류/양서류
      'frog', 'toad', 'lizard', 'snake', 'gecko', 'chameleon',
      'crocodile', 'alligator',
      'dinosaur',
      // 일반
      'animal', 'creature', 'pet', 'wildlife', 'fauna',
      // 한국어
      '고양이', '강아지', '동물', '새', '토끼', '여우', '곰', '판다', '호랑이',
    ],
  },

  food: {
    label: '음식',
    prefix: '음',
    keywords: [
      // 디저트/베이커리
      'cake', 'cupcake', 'cheesecake', 'tart',
      'cookie', 'biscuit', 'macaron', 'macaroon',
      'bread', 'baguette', 'croissant', 'bagel', 'toast', 'roll',
      'donut', 'doughnut',
      'pancake', 'waffle', 'crepe',
      'ice cream', 'gelato', 'sorbet', 'sundae', 'popsicle',
      'chocolate', 'candy', 'lollipop', 'gummy',
      'pudding', 'jelly', 'mousse',
      'pastry', 'pie',
      // 식사
      'pizza', 'pasta', 'spaghetti', 'noodle', 'noodles', 'ramen', 'udon',
      'burger', 'hamburger', 'sandwich', 'taco', 'burrito',
      'sushi', 'sashimi',
      'rice', 'curry', 'stew', 'soup', 'broth',
      'salad', 'bowl',
      'steak', 'meat',
      'cheese',
      'egg', 'eggs',
      // 음료
      'coffee', 'espresso', 'latte', 'cappuccino', 'mocha', 'americano',
      'tea', 'matcha', 'chai',
      'juice', 'smoothie', 'milkshake',
      'milk', 'cocoa',
      'wine', 'beer', 'cocktail', 'champagne',
      'soda', 'lemonade',
      'water', 'drink', 'beverage',
      // 과일
      'apple', 'banana', 'orange', 'lemon', 'lime',
      'strawberry', 'cherry', 'grape', 'blueberry', 'raspberry', 'blackberry',
      'watermelon', 'melon', 'mango', 'pineapple', 'kiwi',
      'peach', 'pear', 'plum', 'fig', 'apricot',
      'fruit', 'fruits', 'berry', 'berries',
      // 채소
      'tomato', 'avocado', 'cucumber', 'carrot',
      'pumpkin', 'corn',
      'vegetable', 'veggies',
      // 일반
      'food', 'meal', 'dish', 'cuisine', 'dessert', 'snack',
      'breakfast', 'lunch', 'dinner', 'brunch',
      // 한국어
      '음식', '커피', '빵', '케이크', '과일', '디저트', '음료',
    ],
  },

  nature: {
    label: '자연',
    prefix: '자',
    keywords: [
      // 식물
      'tree', 'trees', 'forest', 'woodland', 'jungle',
      'flower', 'flowers', 'rose', 'tulip', 'sunflower', 'daisy', 'lily',
      'orchid', 'lotus', 'cherry blossom', 'sakura',
      'leaf', 'leaves', 'foliage',
      'grass', 'meadow', 'field',
      'plant', 'plants', 'fern', 'moss', 'vine', 'ivy',
      'bush', 'shrub',
      'mushroom', 'fungi',
      'cactus',
      // 풍경 요소
      'mountain', 'mountains', 'hill', 'valley', 'cliff', 'canyon',
      'river', 'stream', 'creek', 'waterfall',
      'lake', 'pond', 'pool',
      'ocean', 'sea', 'beach', 'shore', 'coast', 'wave', 'waves',
      'island',
      'desert', 'oasis', 'dune',
      'volcano', 'cave',
      // 하늘/우주
      'sky', 'cloud', 'clouds', 'fog', 'mist',
      'sun', 'sunrise', 'sunset', 'dawn', 'dusk', 'twilight',
      'moon', 'crescent',
      'star', 'stars', 'starry', 'constellation',
      'rainbow', 'aurora',
      // 날씨/계절
      'rain', 'rainy', 'storm', 'thunder', 'lightning',
      'snow', 'snowy', 'snowflake',
      'wind', 'windy',
      'autumn', 'fall', 'winter', 'spring', 'summer', 'season', 'seasonal',
      // 일반
      'nature', 'natural', 'landscape', 'scenery', 'vista',
      'garden', 'park',
      'rock', 'stone', 'pebble', 'crystal', 'gem',
      // 한국어
      '자연', '꽃', '나무', '하늘', '바다', '산', '강', '숲', '풍경',
    ],
  },

  building: {
    label: '건물·공간',
    prefix: '건',
    keywords: [
      // 건물 종류
      'house', 'home', 'cottage', 'cabin', 'villa', 'mansion',
      'building', 'skyscraper', 'tower', 'highrise',
      'castle', 'palace', 'fortress',
      'church', 'cathedral', 'chapel', 'temple', 'shrine', 'pagoda',
      'cafe', 'coffee shop', 'restaurant', 'bistro', 'diner', 'bar', 'pub',
      'shop', 'store', 'boutique', 'market', 'mall',
      'station', 'airport', 'terminal',
      'hospital', 'clinic',
      'school', 'university', 'library',
      'museum', 'gallery', 'theater', 'cinema',
      'bridge', 'tunnel', 'lighthouse',
      'barn', 'farm', 'farmhouse',
      // 도시/장소
      'city', 'town', 'village', 'metropolis', 'downtown',
      'street', 'road', 'avenue', 'alley', 'plaza', 'square',
      'apartment', 'condo', 'studio',
      // 실내
      'room', 'bedroom', 'kitchen', 'bathroom', 'living room',
      'office', 'workspace',
      'window', 'door', 'wall', 'roof', 'ceiling', 'floor',
      'staircase', 'stairs',
      'fireplace',
      'shelf', 'shelves', 'bookshelf',
      // 일반
      'interior', 'exterior', 'architecture', 'architectural',
      'urban', 'rural',
      // 한국어
      '집', '건물', '카페', '도시', '실내', '거리', '방',
    ],
  },

  person: {
    label: '인물',
    prefix: '인',
    keywords: [
      'person', 'people', 'human', 'humanoid',
      'man', 'gentleman', 'guy',
      'woman', 'lady',
      'boy', 'girl',
      'child', 'children', 'kid', 'kids', 'newborn', 'infant', 'toddler',
      'teenager', 'teen', 'adult', 'elderly', 'senior',
      'family', 'mother', 'father', 'daughter', 'son',
      'couple', 'lovers',
      'friends', 'group',
      'crowd',
      'character', 'figure', 'silhouette',
      'portrait', 'face', 'visage', 'profile',
      'student', 'worker', 'professional',
      'artist', 'painter', 'musician', 'singer', 'dancer',
      'chef', 'cook', 'baker', 'barista',
      'doctor', 'nurse', 'teacher',
      'warrior', 'knight', 'samurai', 'soldier',
      'queen', 'king', 'princess', 'prince',
      'hero', 'heroine',
      'self portrait',
      // 한국어
      '사람', '인물', '소녀', '소년', '여자', '남자', '아이',
    ],
  },

  fashion: {
    label: '의상·소품',
    prefix: '옷',
    keywords: [
      // 의류
      'dress', 'gown', 'skirt',
      'shirt', 'blouse', 't-shirt', 'tank top', 'tee',
      'pants', 'trousers', 'jeans', 'shorts', 'leggings',
      'jacket', 'coat', 'blazer', 'cardigan', 'sweater', 'hoodie', 'parka',
      'suit', 'tuxedo',
      'kimono', 'hanbok', 'sari',
      'pajamas', 'robe',
      // 신발
      'shoes', 'boots', 'sneakers', 'sandals', 'heels', 'loafers',
      // 모자/소품
      'hat', 'cap', 'beanie', 'helmet', 'crown', 'tiara',
      'scarf', 'shawl', 'gloves', 'mittens',
      // 가방
      'bag', 'handbag', 'backpack', 'tote', 'purse', 'wallet', 'briefcase',
      // 보석/장신구
      'jewelry', 'necklace', 'pendant',
      'ring', 'bracelet', 'earrings', 'brooch',
      'watch',
      'glasses', 'sunglasses', 'goggles',
      'tie', 'bowtie', 'belt',
      // 일반
      'fashion', 'outfit', 'clothing', 'apparel', 'attire',
      'wear', 'accessory', 'accessories',
      'costume', 'uniform',
      // 한국어
      '옷', '의상', '패션', '신발', '가방',
    ],
  },

  vehicle: {
    label: '운송수단',
    prefix: '차',
    keywords: [
      // 자동차
      'car', 'auto', 'sedan', 'suv', 'hatchback', 'convertible',
      'truck', 'pickup', 'van',
      'bus', 'taxi', 'cab',
      'tractor',
      // 두 바퀴
      'bike', 'bicycle', 'motorcycle', 'motorbike', 'scooter',
      // 철도
      'train', 'subway', 'metro', 'tram', 'streetcar', 'locomotive',
      // 항공
      'plane', 'airplane', 'aircraft', 'jet',
      'helicopter', 'drone',
      'rocket', 'spaceship', 'spacecraft',
      'hot air balloon', 'blimp',
      // 수상
      'ship', 'boat', 'yacht', 'sailboat', 'canoe', 'kayak',
      'submarine',
      // 일반
      'vehicle', 'transport', 'transportation',
      // 한국어
      '자동차', '비행기', '배', '기차',
    ],
  },

  pattern: {
    label: '패턴·추상',
    prefix: '무',
    keywords: [
      'pattern', 'patterns', 'patterned',
      'geometric', 'geometry',
      'abstract', 'abstraction',
      'tile', 'tiles', 'mosaic',
      'texture', 'textured',
      'wallpaper', 'fabric pattern', 'textile pattern',
      'gradient', 'ombre',
      'stripe', 'striped', 'stripes',
      'polka dot', 'dotted',
      'checkered', 'plaid', 'tartan',
      'mandala', 'kaleidoscope',
      'fractal', 'fractals',
      'symmetry', 'symmetrical',
      'tessellation',
      'spiral', 'swirl',
      'zigzag', 'chevron',
      // 한국어
      '패턴', '무늬', '추상',
    ],
  },

  fantasy: {
    label: '판타지',
    prefix: '판',
    keywords: [
      'fairy', 'fairies', 'pixie',
      'dragon', 'wyvern',
      'unicorn', 'pegasus',
      'mermaid', 'merman', 'siren',
      'witch', 'wizard', 'sorcerer', 'sorceress', 'mage',
      'magic', 'magical', 'enchanted', 'enchanting',
      'elf', 'elven', 'elves',
      'dwarf',
      'goblin', 'troll', 'orc',
      'phoenix', 'griffin', 'gryphon',
      'angel', 'angelic', 'cherub',
      'demon', 'demonic', 'devil',
      'ghost', 'phantom', 'specter',
      'spirit',
      'monster', 'beast',
      'mythical', 'mythological', 'mythology',
      'legend', 'legendary', 'fable', 'fairytale', 'fairy tale',
      'mystical', 'mystic',
      'wand', 'spell', 'potion', 'cauldron',
      'rune', 'arcane',
      'medieval',
      // 한국어
      '판타지', '요정', '마법', '용', '드래곤',
    ],
  },

  scifi: {
    label: 'SF·사이버',
    prefix: '미',
    keywords: [
      'robot', 'cyborg', 'android', 'mecha', 'mech',
      'astronaut', 'cosmonaut',
      'alien', 'extraterrestrial', 'ufo',
      'galaxy', 'nebula', 'cosmos', 'cosmic',
      'space station', 'spaceship', 'spacecraft',
      'cyber', 'cyberpunk', 'cybernetic',
      'futuristic', 'dystopian', 'dystopia', 'utopia',
      'high-tech', 'high tech',
      'neon',
      'hologram', 'holographic',
      'sci-fi', 'sci fi', 'science fiction',
      'laser', 'plasma',
      'circuit',
      // 한국어
      '로봇', '우주', '미래', '사이버',
    ],
  },

  // ── Modifier 카테고리 (주제 매치 없을 때만 사용) ──
  emotion: {
    label: '감성·분위기',
    prefix: '감',
    keywords: [
      'cozy', 'warm', 'comfy', 'comforting',
      'peaceful', 'serene', 'tranquil', 'calm',
      'dreamy', 'ethereal', 'whimsical',
      'romantic', 'romance',
      'mysterious', 'enigmatic',
      'eerie', 'creepy', 'spooky', 'haunting',
      'cheerful', 'joyful',
      'lonely', 'solitary', 'isolated',
      'melancholy', 'melancholic', 'wistful',
      'nostalgic', 'nostalgia',
      'surreal', 'surrealism',
      'whimsy',
      'cute', 'kawaii', 'adorable',
      'lovely', 'pretty', 'beautiful',
      'elegant', 'graceful', 'sophisticated',
      'minimalist', 'minimal',
      'vibrant', 'colorful',
      'monochrome', 'monochromatic',
      // 한국어
      '귀여운', '아늑한', '몽환적',
    ],
  },

  artstyle: {
    label: '스타일',
    prefix: '스',
    keywords: [
      'watercolor', 'oil painting', 'acrylic',
      'pencil sketch', 'charcoal', 'ink drawing',
      'pastel',
      'digital art', 'digital painting',
      'pixel art', 'voxel',
      '3d render', '3d', 'cgi',
      'photograph', 'photography', 'photographic', 'photo realistic', 'photorealistic',
      'anime', 'manga',
      'cartoon', 'cartoonish',
      'comic', 'comic book',
      'illustration', 'illustrated',
      'concept art',
      'flat design', 'flat illustration',
      'isometric',
      'low poly',
      'paper cut', 'paper craft', 'origami',
      'embroidery', 'cross stitch',
      'sticker', 'stickers',
      'vintage', 'retro',
      'sketch',
      'line art', 'lineart',
      'vector art',
      // 한국어
      '수채화', '일러스트',
    ],
  },
};

// 주제 카테고리 (이쪽이 우선)
export const TOPIC_CATEGORIES = [
  'animal', 'food', 'nature', 'building', 'person',
  'fashion', 'vehicle', 'pattern', 'fantasy', 'scifi',
];

// Modifier 카테고리 (주제 매치 없을 때만 사용)
export const MODIFIER_CATEGORIES = ['emotion', 'artstyle'];

export const ALL_CATEGORY_IDS = Object.keys(CATEGORIES);
