/**
 * Korea Culture MCP Server - Vercel Serverless Handler
 *
 * 영화, 공연, 축제, 관광, 맛집 등 한국 문화 정보를 AI로 조회하는 MCP 서버
 *
 * 제공 도구 (9개):
 * - culture_get_box_office: 일별/주간 영화 박스오피스
 * - culture_get_movie_detail: 영화 상세정보
 * - culture_search_performance: 공연 검색
 * - culture_get_performance_detail: 공연 상세정보
 * - culture_get_facility_info: 공연장 정보
 * - culture_get_recommendations: 오늘의 추천
 * - culture_search_festival: 축제/행사 검색 (TourAPI)
 * - culture_search_tourist_spot: 관광지 검색 (TourAPI)
 * - culture_search_restaurant: 맛집/음식점 검색 (TourAPI)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

// ===== 타입 정의 =====

interface BoxOfficeMovie {
  rank: string;
  movieNm: string;
  openDt: string;
  audiAcc: string;
  audiCnt: string;
  salesAcc: string;
  movieCd: string;
}

interface MovieDetail {
  movieCd: string;
  movieNm: string;
  movieNmEn: string;
  showTm: string;
  openDt: string;
  prdtStatNm: string;
  typeNm: string;
  nations: { nationNm: string }[];
  genres: { genreNm: string }[];
  directors: { peopleNm: string }[];
  actors: { peopleNm: string; cast: string }[];
  companys: { companyNm: string; companyPartNm: string }[];
  audits: { watchGradeNm: string }[];
}

interface Performance {
  mt20id: string;
  prfnm: string;
  prfpdfrom: string;
  prfpdto: string;
  fcltynm: string;
  poster: string;
  genrenm: string;
  prfstate: string;
  openrun: string;
  area: string;
}

interface PerformanceDetail {
  mt20id: string;
  prfnm: string;
  prfpdfrom: string;
  prfpdto: string;
  fcltynm: string;
  prfcast: string;
  prfcrew: string;
  prfruntime: string;
  prfage: string;
  pcseguidance: string;
  poster: string;
  genrenm: string;
  prfstate: string;
  styurls?: { styurl: string[] };
  dtguidance: string;
}

interface Facility {
  mt10id: string;
  fcltynm: string;
  mt13cnt: string;
  fcltychartr: string;
  sidonm: string;
  gugunnm: string;
  opende: string;
  seatscale: string;
  telno: string;
  relateurl: string;
  adres: string;
  la: string;
  lo: string;
}

interface FacilityDetail {
  mt10id: string;
  fcltynm: string;
  mt13cnt: string;
  fcltychartr: string;
  opende: string;
  seatscale: string;
  telno: string;
  relateurl: string;
  adres: string;
  la: string;
  lo: string;
  // 부대시설
  parkinglot: string;
  restaurant: string;
  cafe: string;
  store: string;
  nolibang: string;
  suyu: string;
  barrier: string;
  // 홀 정보
  mt13s: HallInfo[];
}

interface HallInfo {
  mt13id: string;
  prfplcnm: string;
  seatscale: string;
  stageorchat: string;
  stagepitchat: string;
  stagewichat: string;
  stagehechat: string;
}

// TourAPI 타입
interface TourItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  addr1: string;
  addr2?: string;
  areacode: string;
  sigungucode?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  firstimage?: string;
  firstimage2?: string;
  mapx?: string;
  mapy?: string;
  tel?: string;
  eventstartdate?: string;
  eventenddate?: string;
  eventplace?: string;
  readcount?: string;
}

interface TourDetailCommon {
  contentid: string;
  contenttypeid: string;
  title: string;
  overview?: string;
  homepage?: string;
  tel?: string;
  addr1?: string;
  addr2?: string;
  mapx?: string;
  mapy?: string;
  firstimage?: string;
}

interface TourDetailIntro {
  // 축제/행사 (contenttypeid: 15)
  eventstartdate?: string;
  eventenddate?: string;
  eventplace?: string;
  eventhomepage?: string;
  playtime?: string;
  program?: string;
  usetimefestival?: string;
  sponsor1?: string;
  sponsor1tel?: string;
  // 관광지 (contenttypeid: 12)
  infocenter?: string;
  restdate?: string;
  usetime?: string;
  parking?: string;
  // 음식점 (contenttypeid: 39)
  opentimefood?: string;
  restdatefood?: string;
  firstmenu?: string;
  treatmenu?: string;
  packing?: string;
  parkingfood?: string;
  reservationfood?: string;
}

interface ToolArguments {
  type?: string;
  date?: string;
  movie_name?: string;
  movie_code?: string;
  keyword?: string;
  genre?: string;
  region?: string;
  performance_id?: string;
  facility_name?: string;
  limit?: number;
  response_format?: string;
}

// ===== 에러 메시지 추출 헬퍼 =====

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// ===== 환경 변수 =====

const KOBIS_API_KEY = process.env.KOBIS_API_KEY;
const KOPIS_API_KEY = process.env.KOPIS_API_KEY;
const TOUR_API_KEY_RAW = process.env.TOUR_API_KEY;
const TOUR_API_KEY = TOUR_API_KEY_RAW ? encodeURIComponent(TOUR_API_KEY_RAW) : "";

if (!KOBIS_API_KEY) {
  console.error("KOBIS_API_KEY 환경 변수가 설정되지 않았습니다.");
}
if (!KOPIS_API_KEY) {
  console.error("KOPIS_API_KEY 환경 변수가 설정되지 않았습니다.");
}
if (!TOUR_API_KEY_RAW) {
  console.error("TOUR_API_KEY 환경 변수가 설정되지 않았습니다.");
}

// ===== 상수 =====

const SERVER_INFO = {
  name: "korea-culture-mcp",
  version: "1.0.0",
};

const CHARACTER_LIMIT = 25000;
const DEFAULT_TIMEOUT = 15000;

const GENRE_MAP: Record<string, string> = {
  "연극": "AAAA",
  "뮤지컬": "GGGA",
  "클래식": "CCCA",
  "국악": "CCCC",
  "대중음악": "CCCD",
  "무용": "BBBA",
  "서커스/마술": "EEEA",
  "복합": "EEEB",
};

const REGION_MAP: Record<string, string> = {
  "서울": "11",
  "부산": "26",
  "대구": "27",
  "인천": "28",
  "광주": "29",
  "대전": "30",
  "울산": "31",
  "세종": "36",
  "경기": "41",
  "강원": "42",
  "충북": "43",
  "충남": "44",
  "전북": "45",
  "전남": "46",
  "경북": "47",
  "경남": "48",
  "제주": "50",
};

// TourAPI 지역 코드 (공공데이터포털)
const TOUR_AREA_CODE: Record<string, string> = {
  "서울": "1",
  "인천": "2",
  "대전": "3",
  "대구": "4",
  "광주": "5",
  "부산": "6",
  "울산": "7",
  "세종": "8",
  "경기": "31",
  "강원": "32",
  "충북": "33",
  "충남": "34",
  "경북": "35",
  "경남": "36",
  "전북": "37",
  "전남": "38",
  "제주": "39",
};

// TourAPI 콘텐츠 타입
const TOUR_CONTENT_TYPE: Record<string, string> = {
  "관광지": "12",
  "문화시설": "14",
  "축제행사": "15",
  "여행코스": "25",
  "레포츠": "28",
  "숙박": "32",
  "쇼핑": "38",
  "음식점": "39",
};

const TOUR_API_BASE = "http://apis.data.go.kr/B551011/KorService2";

// ===== 도구 정의 =====

const TOOLS = [
  {
    name: "culture_get_box_office",
    description: "일별 또는 주간 영화 박스오피스 순위를 조회합니다. 현재 상영 중인 인기 영화를 확인할 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["daily", "weekly"],
          description: "박스오피스 유형: daily(일별), weekly(주간). 기본값: daily",
        },
        date: {
          type: "string",
          description: "조회 날짜 (YYYYMMDD 형식). 기본값: 어제 날짜",
        },
        limit: {
          type: "number",
          description: "조회할 영화 수 (1-10). 기본값: 10",
        },
        response_format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "응답 형식. 기본값: markdown",
        },
      },
      required: [],
    },
  },
  {
    name: "culture_get_movie_detail",
    description: "특정 영화의 상세정보를 조회합니다. 감독, 배우, 줄거리, 관람등급 등을 확인할 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        movie_name: {
          type: "string",
          description: "영화 제목으로 검색",
        },
        movie_code: {
          type: "string",
          description: "KOBIS 영화 코드 (박스오피스에서 확인 가능)",
        },
        response_format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "응답 형식. 기본값: markdown",
        },
      },
      required: [],
    },
  },
  {
    name: "culture_search_performance",
    description: "공연을 검색합니다. 연극, 뮤지컬, 콘서트, 클래식 등 다양한 장르의 공연을 찾을 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "검색 키워드 (공연명)",
        },
        genre: {
          type: "string",
          enum: ["연극", "뮤지컬", "클래식", "국악", "대중음악", "무용", "서커스/마술", "복합"],
          description: "공연 장르",
        },
        region: {
          type: "string",
          description: "지역명 (예: 서울, 부산, 대구 등)",
        },
        limit: {
          type: "number",
          description: "조회할 공연 수 (1-20). 기본값: 10",
        },
        response_format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "응답 형식. 기본값: markdown",
        },
      },
      required: [],
    },
  },
  {
    name: "culture_get_performance_detail",
    description: "특정 공연의 상세정보를 조회합니다. 출연진, 공연시간, 티켓가격, 공연장 정보 등을 확인할 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        performance_id: {
          type: "string",
          description: "공연 ID (공연 검색에서 확인 가능)",
        },
        response_format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "응답 형식. 기본값: markdown",
        },
      },
      required: ["performance_id"],
    },
  },
  {
    name: "culture_get_facility_info",
    description: "공연장/극장 정보를 조회합니다. 위치, 좌석수, 연락처 등을 확인할 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        facility_name: {
          type: "string",
          description: "공연장 이름으로 검색",
        },
        region: {
          type: "string",
          description: "지역명 (예: 서울, 부산 등)",
        },
        limit: {
          type: "number",
          description: "조회할 공연장 수 (1-20). 기본값: 10",
        },
        response_format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "응답 형식. 기본값: markdown",
        },
      },
      required: [],
    },
  },
  {
    name: "culture_get_recommendations",
    description: "오늘의 추천 콘텐츠를 제공합니다. 인기 영화와 공연을 한 번에 확인할 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "공연 추천 지역 (예: 서울). 기본값: 서울",
        },
        response_format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "응답 형식. 기본값: markdown",
        },
      },
      required: [],
    },
  },
  // TourAPI 도구들
  {
    name: "culture_search_festival",
    description: "전국의 축제와 행사를 검색합니다. 지역별, 월별로 진행 중이거나 예정된 축제를 찾을 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "검색 키워드 (축제명)",
        },
        region: {
          type: "string",
          description: "지역명 (예: 서울, 부산, 제주 등)",
        },
        month: {
          type: "string",
          description: "조회할 월 (1-12). 기본값: 현재 월",
        },
        limit: {
          type: "number",
          description: "조회할 축제 수 (1-20). 기본값: 10",
        },
        response_format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "응답 형식. 기본값: markdown",
        },
      },
      required: [],
    },
  },
  {
    name: "culture_search_tourist_spot",
    description: "전국의 관광지와 명소를 검색합니다. 지역별 인기 관광지, 문화시설, 테마여행지를 찾을 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "검색 키워드 (관광지명)",
        },
        region: {
          type: "string",
          description: "지역명 (예: 서울, 부산, 제주 등)",
        },
        category: {
          type: "string",
          enum: ["관광지", "문화시설", "레포츠", "쇼핑"],
          description: "관광지 유형. 기본값: 관광지",
        },
        limit: {
          type: "number",
          description: "조회할 관광지 수 (1-20). 기본값: 10",
        },
        response_format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "응답 형식. 기본값: markdown",
        },
      },
      required: [],
    },
  },
  {
    name: "culture_search_restaurant",
    description: "전국의 맛집과 음식점을 검색합니다. 지역별 인기 음식점, 한식/양식/중식 등 다양한 맛집을 찾을 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "검색 키워드 (음식점명 또는 음식 종류)",
        },
        region: {
          type: "string",
          description: "지역명 (예: 서울, 부산, 전주 등)",
        },
        limit: {
          type: "number",
          description: "조회할 음식점 수 (1-20). 기본값: 10",
        },
        response_format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "응답 형식. 기본값: markdown",
        },
      },
      required: [],
    },
  },
];

// ===== 유틸리티 함수 =====

function truncateResponse(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + "\n\n... (응답이 너무 길어 일부가 생략되었습니다)";
}

async function fetchWithTimeout(url: string, timeout = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function getYesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
}

function formatNumber(num: string | number): string {
  return Number(num).toLocaleString("ko-KR");
}

// ===== XML 파싱 헬퍼 (KOPIS는 XML 응답) =====

function extractXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}><!\\[CDATA\\[(.+?)\\]\\]></${tag}>|<${tag}>(.+?)</${tag}>`, "s");
  const match = xml.match(regex);
  return match ? (match[1] || match[2] || "").trim() : "";
}

function extractXmlArray(xml: string, itemTag: string): string[] {
  const regex = new RegExp(`<${itemTag}><!\\[CDATA\\[(.+?)\\]\\]></${itemTag}>|<${itemTag}>(.+?)</${itemTag}>`, "gs");
  const matches = [...xml.matchAll(regex)];
  return matches.map(m => (m[1] || m[2] || "").trim());
}

function parsePerformanceList(xml: string): Performance[] {
  const items: Performance[] = [];
  const dbRegex = /<db>([\s\S]*?)<\/db>/g;
  let match;

  while ((match = dbRegex.exec(xml)) !== null) {
    const item = match[1];
    items.push({
      mt20id: extractXmlValue(item, "mt20id"),
      prfnm: extractXmlValue(item, "prfnm"),
      prfpdfrom: extractXmlValue(item, "prfpdfrom"),
      prfpdto: extractXmlValue(item, "prfpdto"),
      fcltynm: extractXmlValue(item, "fcltynm"),
      poster: extractXmlValue(item, "poster"),
      genrenm: extractXmlValue(item, "genrenm"),
      prfstate: extractXmlValue(item, "prfstate"),
      openrun: extractXmlValue(item, "openrun"),
      area: extractXmlValue(item, "area"),
    });
  }

  return items;
}

function parseFacilityList(xml: string): Facility[] {
  const items: Facility[] = [];
  const dbRegex = /<db>([\s\S]*?)<\/db>/g;
  let match;

  while ((match = dbRegex.exec(xml)) !== null) {
    const item = match[1];
    items.push({
      mt10id: extractXmlValue(item, "mt10id"),
      fcltynm: extractXmlValue(item, "fcltynm"),
      mt13cnt: extractXmlValue(item, "mt13cnt"),
      fcltychartr: extractXmlValue(item, "fcltychartr"),
      sidonm: extractXmlValue(item, "sidonm"),
      gugunnm: extractXmlValue(item, "gugunnm"),
      opende: extractXmlValue(item, "opende"),
      seatscale: extractXmlValue(item, "seatscale"),
      telno: extractXmlValue(item, "telno"),
      relateurl: extractXmlValue(item, "relateurl"),
      adres: extractXmlValue(item, "adres"),
      la: extractXmlValue(item, "la"),
      lo: extractXmlValue(item, "lo"),
    });
  }

  return items;
}

function parseFacilityDetail(xml: string): FacilityDetail | null {
  if (!xml.includes("<db>")) return null;

  // 홀 정보 파싱
  const halls: HallInfo[] = [];
  const mt13Regex = /<mt13>([\s\S]*?)<\/mt13>/g;
  let hallMatch;

  while ((hallMatch = mt13Regex.exec(xml)) !== null) {
    const hallXml = hallMatch[1];
    halls.push({
      mt13id: extractXmlValue(hallXml, "mt13id"),
      prfplcnm: extractXmlValue(hallXml, "prfplcnm"),
      seatscale: extractXmlValue(hallXml, "seatscale"),
      stageorchat: extractXmlValue(hallXml, "stageorchat"),
      stagepitchat: extractXmlValue(hallXml, "stagepitchat"),
      stagewichat: extractXmlValue(hallXml, "stagewichat"),
      stagehechat: extractXmlValue(hallXml, "stagehechat"),
    });
  }

  return {
    mt10id: extractXmlValue(xml, "mt10id"),
    fcltynm: extractXmlValue(xml, "fcltynm"),
    mt13cnt: extractXmlValue(xml, "mt13cnt"),
    fcltychartr: extractXmlValue(xml, "fcltychartr"),
    opende: extractXmlValue(xml, "opende"),
    seatscale: extractXmlValue(xml, "seatscale"),
    telno: extractXmlValue(xml, "telno"),
    relateurl: extractXmlValue(xml, "relateurl"),
    adres: extractXmlValue(xml, "adres"),
    la: extractXmlValue(xml, "la"),
    lo: extractXmlValue(xml, "lo"),
    parkinglot: extractXmlValue(xml, "parkinglot"),
    restaurant: extractXmlValue(xml, "restaurant"),
    cafe: extractXmlValue(xml, "cafe"),
    store: extractXmlValue(xml, "store"),
    nolibang: extractXmlValue(xml, "nolibang"),
    suyu: extractXmlValue(xml, "suyu"),
    barrier: extractXmlValue(xml, "barrier"),
    mt13s: halls,
  };
}

async function fetchFacilityDetail(facilityId: string): Promise<FacilityDetail | null> {
  try {
    const url = `http://www.kopis.or.kr/openApi/restful/prfplc/${facilityId}?service=${KOPIS_API_KEY}`;
    const response = await fetchWithTimeout(url);
    const xml = await response.text();
    return parseFacilityDetail(xml);
  } catch {
    return null;
  }
}

// ===== 도구 구현 =====

async function cultureGetBoxOffice(args: {
  type?: string;
  date?: string;
  limit?: number;
  response_format?: string;
}): Promise<string> {
  const type = args.type || "daily";
  const date = args.date || getYesterday();
  const limit = Math.min(args.limit || 10, 10);
  const format = args.response_format || "markdown";

  try {
    const endpoint = type === "weekly"
      ? `http://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchWeeklyBoxOfficeList.json?key=${KOBIS_API_KEY}&targetDt=${date}&weekGb=0`
      : `http://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${KOBIS_API_KEY}&targetDt=${date}`;

    const response = await fetchWithTimeout(endpoint);
    const data = await response.json();

    const boxOfficeList = type === "weekly"
      ? data.boxOfficeResult?.weeklyBoxOfficeList || []
      : data.boxOfficeResult?.dailyBoxOfficeList || [];

    const movies: BoxOfficeMovie[] = boxOfficeList.slice(0, limit);

    if (format === "json") {
      return JSON.stringify({
        type,
        date: formatDate(date),
        movies: movies.map(m => ({
          rank: m.rank,
          title: m.movieNm,
          openDate: formatDate(m.openDt),
          audienceToday: formatNumber(m.audiCnt),
          audienceTotal: formatNumber(m.audiAcc),
          salesTotal: formatNumber(m.salesAcc),
          movieCode: m.movieCd,
        })),
      }, null, 2);
    }

    const typeLabel = type === "weekly" ? "주간" : "일별";
    let md = `## 🎬 ${typeLabel} 박스오피스 (${formatDate(date)})\n\n`;

    if (movies.length === 0) {
      return md + "조회된 영화가 없습니다.";
    }

    movies.forEach((m, idx) => {
      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${m.rank}.`;
      md += `### ${medal} ${m.movieNm}\n`;
      md += `- **개봉일**: ${formatDate(m.openDt)}\n`;
      md += `- **당일 관객**: ${formatNumber(m.audiCnt)}명\n`;
      md += `- **누적 관객**: ${formatNumber(m.audiAcc)}명\n`;
      md += `- **누적 매출**: ${formatNumber(m.salesAcc)}원\n`;
      md += `- **영화코드**: \`${m.movieCd}\`\n\n`;
    });

    md += "---\n> 💡 **Tip**: 영화 상세정보는 `culture_get_movie_detail` 도구를 사용하세요.\n";

    return truncateResponse(md);
  } catch (error) {
    return `❌ 박스오피스 조회 실패: ${getErrorMessage(error)}`;
  }
}

async function cultureGetMovieDetail(args: {
  movie_name?: string;
  movie_code?: string;
  response_format?: string;
}): Promise<string> {
  const format = args.response_format || "markdown";

  try {
    let movieCode = args.movie_code;

    // 영화명으로 검색하여 코드 찾기
    if (!movieCode && args.movie_name) {
      const searchUrl = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json?key=${KOBIS_API_KEY}&movieNm=${encodeURIComponent(args.movie_name)}`;
      const searchResponse = await fetchWithTimeout(searchUrl);
      const searchData = await searchResponse.json();
      const movieList = searchData.movieListResult?.movieList || [];

      if (movieList.length === 0) {
        return `❌ "${args.movie_name}" 영화를 찾을 수 없습니다.`;
      }

      movieCode = movieList[0].movieCd;
    }

    if (!movieCode) {
      return "❌ movie_name 또는 movie_code 중 하나를 입력해주세요.";
    }

    const detailUrl = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${KOBIS_API_KEY}&movieCd=${movieCode}`;
    const response = await fetchWithTimeout(detailUrl);
    const data = await response.json();
    const movie: MovieDetail = data.movieInfoResult?.movieInfo;

    if (!movie) {
      return `❌ 영화 정보를 찾을 수 없습니다. (코드: ${movieCode})`;
    }

    if (format === "json") {
      return JSON.stringify({
        code: movie.movieCd,
        title: movie.movieNm,
        titleEn: movie.movieNmEn,
        runtime: movie.showTm,
        openDate: formatDate(movie.openDt),
        status: movie.prdtStatNm,
        type: movie.typeNm,
        nations: movie.nations?.map(n => n.nationNm) || [],
        genres: movie.genres?.map(g => g.genreNm) || [],
        directors: movie.directors?.map(d => d.peopleNm) || [],
        actors: movie.actors?.slice(0, 10).map(a => ({ name: a.peopleNm, role: a.cast })) || [],
        rating: movie.audits?.[0]?.watchGradeNm || "정보 없음",
      }, null, 2);
    }

    let md = `## 🎬 ${movie.movieNm}\n\n`;

    if (movie.movieNmEn) {
      md += `*${movie.movieNmEn}*\n\n`;
    }

    md += `| 항목 | 내용 |\n|------|------|\n`;
    md += `| **개봉일** | ${formatDate(movie.openDt)} |\n`;
    md += `| **상영시간** | ${movie.showTm || "정보 없음"}분 |\n`;
    md += `| **관람등급** | ${movie.audits?.[0]?.watchGradeNm || "정보 없음"} |\n`;
    md += `| **장르** | ${movie.genres?.map(g => g.genreNm).join(", ") || "정보 없음"} |\n`;
    md += `| **국가** | ${movie.nations?.map(n => n.nationNm).join(", ") || "정보 없음"} |\n`;
    md += `| **유형** | ${movie.typeNm || "정보 없음"} |\n\n`;

    if (movie.directors && movie.directors.length > 0) {
      md += `### 🎥 감독\n${movie.directors.map(d => d.peopleNm).join(", ")}\n\n`;
    }

    if (movie.actors && movie.actors.length > 0) {
      md += `### 🎭 출연진\n`;
      movie.actors.slice(0, 10).forEach(a => {
        md += `- **${a.peopleNm}**${a.cast ? ` (${a.cast} 역)` : ""}\n`;
      });
      md += "\n";
    }

    if (movie.companys && movie.companys.length > 0) {
      const producers = movie.companys.filter(c => c.companyPartNm?.includes("제작"));
      const distributors = movie.companys.filter(c => c.companyPartNm?.includes("배급"));

      if (producers.length > 0) {
        md += `### 🏢 제작사\n${producers.map(c => c.companyNm).join(", ")}\n\n`;
      }
      if (distributors.length > 0) {
        md += `### 📦 배급사\n${distributors.map(c => c.companyNm).join(", ")}\n\n`;
      }
    }

    return truncateResponse(md);
  } catch (error) {
    return `❌ 영화 상세정보 조회 실패: ${getErrorMessage(error)}`;
  }
}

async function cultureSearchPerformance(args: {
  keyword?: string;
  genre?: string;
  region?: string;
  limit?: number;
  response_format?: string;
}): Promise<string> {
  const limit = Math.min(args.limit || 10, 20);
  const format = args.response_format || "markdown";

  try {
    let url = `http://www.kopis.or.kr/openApi/restful/pblprfr?service=${KOPIS_API_KEY}&stdate=${getToday()}&eddate=20261231&cpage=1&rows=${limit}`;

    if (args.keyword) {
      url += `&shprfnm=${encodeURIComponent(args.keyword)}`;
    }
    if (args.genre && GENRE_MAP[args.genre]) {
      url += `&shcate=${GENRE_MAP[args.genre]}`;
    }
    if (args.region && REGION_MAP[args.region]) {
      url += `&signgucode=${REGION_MAP[args.region]}`;
    }

    const response = await fetchWithTimeout(url);
    const xml = await response.text();
    const performances = parsePerformanceList(xml);

    if (format === "json") {
      return JSON.stringify({
        keyword: args.keyword || null,
        genre: args.genre || null,
        region: args.region || null,
        count: performances.length,
        performances: performances.map(p => ({
          id: p.mt20id,
          name: p.prfnm,
          period: `${p.prfpdfrom} ~ ${p.prfpdto}`,
          venue: p.fcltynm,
          genre: p.genrenm,
          status: p.prfstate,
          area: p.area,
          poster: p.poster,
        })),
      }, null, 2);
    }

    let md = `## 🎭 공연 검색 결과\n\n`;

    if (args.keyword) md += `> 검색어: "${args.keyword}"\n`;
    if (args.genre) md += `> 장르: ${args.genre}\n`;
    if (args.region) md += `> 지역: ${args.region}\n`;
    md += `> ${performances.length}개 공연 발견\n\n`;

    if (performances.length === 0) {
      return md + "검색된 공연이 없습니다.";
    }

    performances.forEach((p, idx) => {
      const statusEmoji = p.prfstate === "공연중" ? "🟢" : p.prfstate === "공연예정" ? "🟡" : "⚫";
      md += `### ${idx + 1}. ${p.prfnm}\n`;
      md += `- **기간**: ${p.prfpdfrom} ~ ${p.prfpdto}\n`;
      md += `- **장소**: ${p.fcltynm}\n`;
      md += `- **장르**: ${p.genrenm}\n`;
      md += `- **상태**: ${statusEmoji} ${p.prfstate}\n`;
      md += `- **공연ID**: \`${p.mt20id}\`\n\n`;
    });

    md += "---\n> 💡 **Tip**: 공연 상세정보는 `culture_get_performance_detail` 도구에 공연ID를 입력하세요.\n";

    return truncateResponse(md);
  } catch (error) {
    return `❌ 공연 검색 실패: ${getErrorMessage(error)}`;
  }
}

async function cultureGetPerformanceDetail(args: {
  performance_id: string;
  response_format?: string;
}): Promise<string> {
  const format = args.response_format || "markdown";

  try {
    const url = `http://www.kopis.or.kr/openApi/restful/pblprfr/${args.performance_id}?service=${KOPIS_API_KEY}`;
    const response = await fetchWithTimeout(url);
    const xml = await response.text();

    const p: PerformanceDetail = {
      mt20id: extractXmlValue(xml, "mt20id"),
      prfnm: extractXmlValue(xml, "prfnm"),
      prfpdfrom: extractXmlValue(xml, "prfpdfrom"),
      prfpdto: extractXmlValue(xml, "prfpdto"),
      fcltynm: extractXmlValue(xml, "fcltynm"),
      prfcast: extractXmlValue(xml, "prfcast"),
      prfcrew: extractXmlValue(xml, "prfcrew"),
      prfruntime: extractXmlValue(xml, "prfruntime"),
      prfage: extractXmlValue(xml, "prfage"),
      pcseguidance: extractXmlValue(xml, "pcseguidance"),
      poster: extractXmlValue(xml, "poster"),
      genrenm: extractXmlValue(xml, "genrenm"),
      prfstate: extractXmlValue(xml, "prfstate"),
      dtguidance: extractXmlValue(xml, "dtguidance"),
    };

    if (!p.prfnm) {
      return `❌ 공연 정보를 찾을 수 없습니다. (ID: ${args.performance_id})`;
    }

    if (format === "json") {
      return JSON.stringify({
        id: p.mt20id,
        name: p.prfnm,
        period: `${p.prfpdfrom} ~ ${p.prfpdto}`,
        venue: p.fcltynm,
        cast: p.prfcast,
        crew: p.prfcrew,
        runtime: p.prfruntime,
        ageLimit: p.prfage,
        price: p.pcseguidance,
        poster: p.poster,
        genre: p.genrenm,
        status: p.prfstate,
        schedule: p.dtguidance,
      }, null, 2);
    }

    const statusEmoji = p.prfstate === "공연중" ? "🟢" : p.prfstate === "공연예정" ? "🟡" : "⚫";

    let md = `## 🎭 ${p.prfnm}\n\n`;
    md += `${statusEmoji} **${p.prfstate}** | ${p.genrenm}\n\n`;

    md += `| 항목 | 내용 |\n|------|------|\n`;
    md += `| **공연기간** | ${p.prfpdfrom} ~ ${p.prfpdto} |\n`;
    md += `| **공연장** | ${p.fcltynm} |\n`;
    md += `| **관람시간** | ${p.prfruntime || "정보 없음"} |\n`;
    md += `| **관람연령** | ${p.prfage || "정보 없음"} |\n\n`;

    if (p.pcseguidance) {
      md += `### 💰 티켓가격\n${p.pcseguidance.replace(/,/g, "\n")}\n\n`;
    }

    if (p.dtguidance) {
      md += `### 📅 공연시간\n${p.dtguidance}\n\n`;
    }

    if (p.prfcast) {
      md += `### 🎭 출연진\n${p.prfcast}\n\n`;
    }

    if (p.prfcrew) {
      md += `### 🎬 제작진\n${p.prfcrew}\n\n`;
    }

    return truncateResponse(md);
  } catch (error) {
    return `❌ 공연 상세정보 조회 실패: ${getErrorMessage(error)}`;
  }
}

async function cultureGetFacilityInfo(args: {
  facility_name?: string;
  region?: string;
  limit?: number;
  response_format?: string;
}): Promise<string> {
  const limit = Math.min(args.limit || 10, 20);
  const format = args.response_format || "markdown";

  try {
    let url = `http://www.kopis.or.kr/openApi/restful/prfplc?service=${KOPIS_API_KEY}&cpage=1&rows=${limit}`;

    if (args.facility_name) {
      url += `&shprfnmfct=${encodeURIComponent(args.facility_name)}`;
    }
    if (args.region && REGION_MAP[args.region]) {
      url += `&signgucode=${REGION_MAP[args.region]}`;
    }

    const response = await fetchWithTimeout(url);
    const xml = await response.text();
    const facilities = parseFacilityList(xml);

    if (facilities.length === 0) {
      if (format === "json") {
        return JSON.stringify({ keyword: args.facility_name || null, region: args.region || null, count: 0, facilities: [] }, null, 2);
      }
      let md = `## 🏛️ 공연장 검색 결과\n\n`;
      if (args.facility_name) md += `> 검색어: "${args.facility_name}"\n`;
      if (args.region) md += `> 지역: ${args.region}\n`;
      return md + "\n검색된 공연장이 없습니다.";
    }

    // 검색 결과가 3개 이하면 상세 정보도 가져옴
    const shouldFetchDetails = facilities.length <= 3;
    const detailsMap: Map<string, FacilityDetail> = new Map();

    if (shouldFetchDetails) {
      const detailPromises = facilities.map(f => fetchFacilityDetail(f.mt10id));
      const details = await Promise.all(detailPromises);
      details.forEach((detail, idx) => {
        if (detail) {
          detailsMap.set(facilities[idx].mt10id, detail);
        }
      });
    }

    if (format === "json") {
      return JSON.stringify({
        keyword: args.facility_name || null,
        region: args.region || null,
        count: facilities.length,
        facilities: facilities.map(f => {
          const detail = detailsMap.get(f.mt10id);
          return {
            id: f.mt10id,
            name: f.fcltynm,
            type: f.fcltychartr,
            area: `${f.sidonm} ${f.gugunnm}`,
            address: detail?.adres || f.adres,
            seatCount: detail?.seatscale || f.seatscale,
            tel: detail?.telno || f.telno,
            website: detail?.relateurl || f.relateurl,
            openDate: detail?.opende || null,
            parking: detail?.parkinglot || null,
            restaurant: detail?.restaurant || null,
            cafe: detail?.cafe || null,
            store: detail?.store || null,
            barrierFree: detail?.barrier || null,
            nursingRoom: detail?.suyu || null,
            halls: detail?.mt13s?.map(h => ({
              name: h.prfplcnm,
              seats: h.seatscale,
            })) || [],
          };
        }),
      }, null, 2);
    }

    let md = `## 🏛️ 공연장 검색 결과\n\n`;

    if (args.facility_name) md += `> 검색어: "${args.facility_name}"\n`;
    if (args.region) md += `> 지역: ${args.region}\n`;
    md += `> ${facilities.length}개 공연장 발견\n\n`;

    facilities.forEach((f, idx) => {
      const detail = detailsMap.get(f.mt10id);

      md += `### ${idx + 1}. ${f.fcltynm}\n\n`;

      // 기본 정보 테이블
      md += `| 항목 | 내용 |\n|------|------|\n`;
      md += `| **유형** | ${f.fcltychartr || "정보 없음"} |\n`;
      md += `| **위치** | ${f.sidonm} ${f.gugunnm} |\n`;
      md += `| **주소** | ${detail?.adres || f.adres || "정보 없음"} |\n`;
      md += `| **좌석수** | ${detail?.seatscale || f.seatscale || "정보 없음"}석 |\n`;
      if (detail?.telno || f.telno) md += `| **전화** | ${detail?.telno || f.telno} |\n`;
      if (detail?.relateurl || f.relateurl) md += `| **웹사이트** | ${detail?.relateurl || f.relateurl} |\n`;
      if (detail?.opende) md += `| **개관일** | ${detail.opende} |\n`;
      md += "\n";

      // 상세 정보가 있는 경우
      if (detail) {
        // 홀 정보
        if (detail.mt13s && detail.mt13s.length > 0) {
          md += `#### 🎪 공연장(홀) 정보\n`;
          detail.mt13s.forEach(hall => {
            md += `- **${hall.prfplcnm}**: ${hall.seatscale || "정보 없음"}석`;
            if (hall.stageorchat || hall.stagewichat || hall.stagehechat) {
              const dimensions = [];
              if (hall.stagewichat) dimensions.push(`폭 ${hall.stagewichat}m`);
              if (hall.stagehechat) dimensions.push(`높이 ${hall.stagehechat}m`);
              if (hall.stageorchat) dimensions.push(`오케스트라피트 ${hall.stageorchat}m`);
              if (dimensions.length > 0) md += ` (${dimensions.join(", ")})`;
            }
            md += "\n";
          });
          md += "\n";
        }

        // 부대시설
        const amenities: string[] = [];
        if (detail.parkinglot === "Y") amenities.push("🅿️ 주차장");
        if (detail.restaurant === "Y") amenities.push("🍽️ 레스토랑");
        if (detail.cafe === "Y") amenities.push("☕ 카페");
        if (detail.store === "Y") amenities.push("🏪 편의점");
        if (detail.suyu === "Y") amenities.push("👶 수유실");
        if (detail.barrier === "Y") amenities.push("♿ 장애인시설");
        if (detail.nolibang === "Y") amenities.push("🎤 노래방");

        if (amenities.length > 0) {
          md += `#### 🏢 부대시설\n`;
          md += amenities.join(" | ") + "\n\n";
        }

        // 위치 정보 (위경도)
        if (detail.la && detail.lo) {
          md += `#### 📍 위치\n`;
          md += `- 위도: ${detail.la}, 경도: ${detail.lo}\n`;
          md += `- [카카오맵에서 보기](https://map.kakao.com/link/map/${encodeURIComponent(f.fcltynm)},${detail.la},${detail.lo})\n\n`;
        }
      }

      md += "---\n\n";
    });

    return truncateResponse(md);
  } catch (error) {
    return `❌ 공연장 검색 실패: ${getErrorMessage(error)}`;
  }
}

async function cultureGetRecommendations(args: {
  region?: string;
  response_format?: string;
}): Promise<string> {
  const region = args.region || "서울";
  const format = args.response_format || "markdown";

  try {
    // 박스오피스 TOP 5
    const boxOfficeResult = await cultureGetBoxOffice({ type: "daily", limit: 5, response_format: "json" });
    const boxOfficeData = JSON.parse(boxOfficeResult);

    // 뮤지컬 공연 TOP 5
    const musicalResult = await cultureSearchPerformance({ genre: "뮤지컬", region, limit: 5, response_format: "json" });
    const musicalData = JSON.parse(musicalResult);

    // 연극 공연 TOP 5
    const theaterResult = await cultureSearchPerformance({ genre: "연극", region, limit: 5, response_format: "json" });
    const theaterData = JSON.parse(theaterResult);

    if (format === "json") {
      return JSON.stringify({
        date: formatDate(getToday()),
        region,
        movies: boxOfficeData.movies || [],
        musicals: musicalData.performances || [],
        theaters: theaterData.performances || [],
      }, null, 2);
    }

    let md = `## ✨ 오늘의 추천 (${formatDate(getToday())})\n\n`;

    md += `### 🎬 인기 영화 TOP 5\n\n`;
    if (boxOfficeData.movies && boxOfficeData.movies.length > 0) {
      boxOfficeData.movies.forEach((m: any, idx: number) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
        md += `${medal} **${m.title}** - 누적 ${m.audienceTotal}명\n`;
      });
    } else {
      md += "데이터를 불러올 수 없습니다.\n";
    }

    md += `\n### 🎭 ${region} 뮤지컬\n\n`;
    if (musicalData.performances && musicalData.performances.length > 0) {
      musicalData.performances.slice(0, 5).forEach((p: any, idx: number) => {
        md += `${idx + 1}. **${p.name}** @ ${p.venue}\n`;
      });
    } else {
      md += "진행 중인 뮤지컬이 없습니다.\n";
    }

    md += `\n### 🎪 ${region} 연극\n\n`;
    if (theaterData.performances && theaterData.performances.length > 0) {
      theaterData.performances.slice(0, 5).forEach((p: any, idx: number) => {
        md += `${idx + 1}. **${p.name}** @ ${p.venue}\n`;
      });
    } else {
      md += "진행 중인 연극이 없습니다.\n";
    }

    md += "\n---\n> 💡 **Tip**: 상세정보는 각 도구를 사용해 확인하세요!\n";

    return truncateResponse(md);
  } catch (error) {
    return `❌ 추천 정보 조회 실패: ${getErrorMessage(error)}`;
  }
}

// ===== TourAPI 도구 구현 =====

async function cultureSearchFestival(args: {
  keyword?: string;
  region?: string;
  month?: string;
  limit?: number;
  response_format?: string;
}): Promise<string> {
  const limit = Math.min(args.limit || 10, 20);
  const format = args.response_format || "markdown";
  const currentMonth = args.month || String(new Date().getMonth() + 1).padStart(2, "0");
  const year = new Date().getFullYear();

  // 해당 월의 시작일과 종료일
  const eventStartDate = `${year}${currentMonth.padStart(2, "0")}01`;
  const lastDay = new Date(year, parseInt(currentMonth), 0).getDate();
  const eventEndDate = `${year}${currentMonth.padStart(2, "0")}${lastDay}`;

  try {
    let url = `${TOUR_API_BASE}/searchFestival2?serviceKey=${TOUR_API_KEY}&numOfRows=${limit}&pageNo=1&MobileOS=ETC&MobileApp=KoreaCultureMCP&_type=json&listYN=Y&arrange=A&eventStartDate=${eventStartDate}&eventEndDate=${eventEndDate}`;

    if (args.region && TOUR_AREA_CODE[args.region]) {
      url += `&areaCode=${TOUR_AREA_CODE[args.region]}`;
    }

    const response = await fetchWithTimeout(url);
    const data = await response.json();

    let items: TourItem[] = data.response?.body?.items?.item || [];
    if (!Array.isArray(items)) items = items ? [items] : [];

    // 키워드 필터링
    if (args.keyword) {
      const keyword = args.keyword.toLowerCase();
      items = items.filter(item => item.title?.toLowerCase().includes(keyword));
    }

    if (format === "json") {
      return JSON.stringify({
        keyword: args.keyword || null,
        region: args.region || null,
        month: currentMonth,
        count: items.length,
        festivals: items.map(item => ({
          id: item.contentid,
          title: item.title,
          address: `${item.addr1 || ""} ${item.addr2 || ""}`.trim(),
          startDate: item.eventstartdate,
          endDate: item.eventenddate,
          tel: item.tel,
          image: item.firstimage,
        })),
      }, null, 2);
    }

    let md = `## 🎪 축제/행사 검색 결과\n\n`;
    md += `> ${year}년 ${currentMonth}월 축제\n`;
    if (args.keyword) md += `> 검색어: "${args.keyword}"\n`;
    if (args.region) md += `> 지역: ${args.region}\n`;
    md += `> ${items.length}개 축제 발견\n\n`;

    if (items.length === 0) {
      return md + "검색된 축제가 없습니다. 다른 월이나 지역을 검색해보세요.";
    }

    items.forEach((item, idx) => {
      const startDate = item.eventstartdate ? `${item.eventstartdate.slice(0,4)}.${item.eventstartdate.slice(4,6)}.${item.eventstartdate.slice(6,8)}` : "";
      const endDate = item.eventenddate ? `${item.eventenddate.slice(0,4)}.${item.eventenddate.slice(4,6)}.${item.eventenddate.slice(6,8)}` : "";

      md += `### ${idx + 1}. ${item.title}\n\n`;
      md += `| 항목 | 내용 |\n|------|------|\n`;
      if (startDate && endDate) md += `| **기간** | ${startDate} ~ ${endDate} |\n`;
      if (item.addr1) md += `| **장소** | ${item.addr1} ${item.addr2 || ""} |\n`;
      if (item.tel) md += `| **연락처** | ${item.tel} |\n`;
      md += "\n";
    });

    return truncateResponse(md);
  } catch (error) {
    return `❌ 축제 검색 실패: ${getErrorMessage(error)}`;
  }
}

async function cultureSearchTouristSpot(args: {
  keyword?: string;
  region?: string;
  category?: string;
  limit?: number;
  response_format?: string;
}): Promise<string> {
  const limit = Math.min(args.limit || 10, 20);
  const format = args.response_format || "markdown";
  const contentTypeId = TOUR_CONTENT_TYPE[args.category || "관광지"] || "12";

  try {
    let url: string;

    if (args.keyword) {
      // 키워드 검색
      url = `${TOUR_API_BASE}/searchKeyword2?serviceKey=${TOUR_API_KEY}&numOfRows=${limit}&pageNo=1&MobileOS=ETC&MobileApp=KoreaCultureMCP&_type=json&listYN=Y&arrange=P&keyword=${encodeURIComponent(args.keyword)}&contentTypeId=${contentTypeId}`;
    } else {
      // 지역 기반 검색
      url = `${TOUR_API_BASE}/areaBasedList2?serviceKey=${TOUR_API_KEY}&numOfRows=${limit}&pageNo=1&MobileOS=ETC&MobileApp=KoreaCultureMCP&_type=json&listYN=Y&arrange=P&contentTypeId=${contentTypeId}`;
    }

    if (args.region && TOUR_AREA_CODE[args.region]) {
      url += `&areaCode=${TOUR_AREA_CODE[args.region]}`;
    }

    const response = await fetchWithTimeout(url);
    const data = await response.json();

    let items: TourItem[] = data.response?.body?.items?.item || [];
    if (!Array.isArray(items)) items = items ? [items] : [];

    if (format === "json") {
      return JSON.stringify({
        keyword: args.keyword || null,
        region: args.region || null,
        category: args.category || "관광지",
        count: items.length,
        spots: items.map(item => ({
          id: item.contentid,
          title: item.title,
          address: `${item.addr1 || ""} ${item.addr2 || ""}`.trim(),
          tel: item.tel,
          image: item.firstimage,
          mapx: item.mapx,
          mapy: item.mapy,
        })),
      }, null, 2);
    }

    const categoryName = args.category || "관광지";
    let md = `## 🗺️ ${categoryName} 검색 결과\n\n`;
    if (args.keyword) md += `> 검색어: "${args.keyword}"\n`;
    if (args.region) md += `> 지역: ${args.region}\n`;
    md += `> ${items.length}개 ${categoryName} 발견\n\n`;

    if (items.length === 0) {
      return md + `검색된 ${categoryName}이(가) 없습니다.`;
    }

    items.forEach((item, idx) => {
      md += `### ${idx + 1}. ${item.title}\n\n`;
      md += `| 항목 | 내용 |\n|------|------|\n`;
      if (item.addr1) md += `| **주소** | ${item.addr1} ${item.addr2 || ""} |\n`;
      if (item.tel) md += `| **연락처** | ${item.tel} |\n`;
      if (item.mapx && item.mapy) {
        md += `| **지도** | [카카오맵에서 보기](https://map.kakao.com/link/map/${encodeURIComponent(item.title)},${item.mapy},${item.mapx}) |\n`;
      }
      md += "\n";
    });

    return truncateResponse(md);
  } catch (error) {
    return `❌ 관광지 검색 실패: ${getErrorMessage(error)}`;
  }
}

async function cultureSearchRestaurant(args: {
  keyword?: string;
  region?: string;
  limit?: number;
  response_format?: string;
}): Promise<string> {
  const limit = Math.min(args.limit || 10, 20);
  const format = args.response_format || "markdown";
  const contentTypeId = "39"; // 음식점

  try {
    let url: string;

    if (args.keyword) {
      url = `${TOUR_API_BASE}/searchKeyword2?serviceKey=${TOUR_API_KEY}&numOfRows=${limit}&pageNo=1&MobileOS=ETC&MobileApp=KoreaCultureMCP&_type=json&listYN=Y&arrange=P&keyword=${encodeURIComponent(args.keyword)}&contentTypeId=${contentTypeId}`;
    } else {
      url = `${TOUR_API_BASE}/areaBasedList2?serviceKey=${TOUR_API_KEY}&numOfRows=${limit}&pageNo=1&MobileOS=ETC&MobileApp=KoreaCultureMCP&_type=json&listYN=Y&arrange=P&contentTypeId=${contentTypeId}`;
    }

    if (args.region && TOUR_AREA_CODE[args.region]) {
      url += `&areaCode=${TOUR_AREA_CODE[args.region]}`;
    }

    const response = await fetchWithTimeout(url);
    const data = await response.json();

    let items: TourItem[] = data.response?.body?.items?.item || [];
    if (!Array.isArray(items)) items = items ? [items] : [];

    if (format === "json") {
      return JSON.stringify({
        keyword: args.keyword || null,
        region: args.region || null,
        count: items.length,
        restaurants: items.map(item => ({
          id: item.contentid,
          title: item.title,
          address: `${item.addr1 || ""} ${item.addr2 || ""}`.trim(),
          tel: item.tel,
          image: item.firstimage,
          mapx: item.mapx,
          mapy: item.mapy,
        })),
      }, null, 2);
    }

    let md = `## 🍽️ 맛집/음식점 검색 결과\n\n`;
    if (args.keyword) md += `> 검색어: "${args.keyword}"\n`;
    if (args.region) md += `> 지역: ${args.region}\n`;
    md += `> ${items.length}개 음식점 발견\n\n`;

    if (items.length === 0) {
      return md + "검색된 음식점이 없습니다.";
    }

    items.forEach((item, idx) => {
      md += `### ${idx + 1}. ${item.title}\n\n`;
      md += `| 항목 | 내용 |\n|------|------|\n`;
      if (item.addr1) md += `| **주소** | ${item.addr1} ${item.addr2 || ""} |\n`;
      if (item.tel) md += `| **연락처** | ${item.tel} |\n`;
      if (item.mapx && item.mapy) {
        md += `| **지도** | [카카오맵에서 보기](https://map.kakao.com/link/map/${encodeURIComponent(item.title)},${item.mapy},${item.mapx}) |\n`;
      }
      md += "\n";
    });

    return truncateResponse(md);
  } catch (error) {
    return `❌ 음식점 검색 실패: ${getErrorMessage(error)}`;
  }
}

// ===== JSON-RPC 헬퍼 =====

function jsonRpcResponse(id: number | string | null, result: any) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: number | string | null, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

// ===== 랜딩페이지 HTML =====

const LANDING_PAGE_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="영화 박스오피스, 공연/전시 정보를 AI로 조회하는 MCP 서버">
  <meta property="og:title" content="Korea Culture MCP - 영화/공연 AI 조회">
  <meta property="og:description" content="오늘 뭐 볼까? 라고 물으면 바로 답해드립니다.">
  <title>Korea Culture MCP - 영화/공연 AI 조회</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Noto+Sans+KR:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --gold: #d4af37;
      --gold-light: #f4e4bc;
      --gold-dark: #b8860b;
      --crimson: #8b0000;
      --crimson-light: #dc143c;
      --velvet: #1a0a0a;
      --velvet-light: #2d1515;
      --cream: #faf8f5;
      --shadow: rgba(0,0,0,0.5);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Noto Sans KR', sans-serif;
      background: var(--velvet);
      color: var(--cream);
      line-height: 1.7;
      overflow-x: hidden;
    }

    /* Curtain Animation */
    .curtain-left, .curtain-right {
      position: fixed;
      top: 0;
      width: 51%;
      height: 100vh;
      background: linear-gradient(180deg, #4a0000 0%, #8b0000 50%, #4a0000 100%);
      z-index: 9999;
      animation: curtainOpen 1.5s ease-out forwards;
    }
    .curtain-left { left: 0; transform-origin: left; }
    .curtain-right { right: 0; transform-origin: right; }
    .curtain-left::after, .curtain-right::after {
      content: '';
      position: absolute;
      top: 0;
      width: 100%;
      height: 100%;
      background: repeating-linear-gradient(90deg, transparent 0, transparent 30px, rgba(0,0,0,0.1) 30px, rgba(0,0,0,0.1) 60px);
    }
    @keyframes curtainOpen {
      0% { transform: scaleX(1); }
      100% { transform: scaleX(0); }
    }

    /* Film Strip Decoration */
    .film-strip {
      position: fixed;
      top: 0;
      width: 40px;
      height: 100%;
      background: #111;
      z-index: 100;
      opacity: 0.6;
    }
    .film-strip::before {
      content: '';
      position: absolute;
      top: 0;
      left: 8px;
      width: 24px;
      height: 100%;
      background: repeating-linear-gradient(to bottom, transparent 0, transparent 20px, #222 20px, #222 30px, transparent 30px, transparent 50px);
    }
    .film-strip.left { left: 0; }
    .film-strip.right { right: 0; }

    /* Spotlight Effect */
    .spotlight {
      position: fixed;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%);
      pointer-events: none;
      z-index: 50;
      transition: all 0.3s ease;
    }

    /* Hero Section */
    .hero {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 60px 20px;
      position: relative;
      background:
        radial-gradient(ellipse at 50% 0%, rgba(139,0,0,0.3) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(212,175,55,0.1) 0%, transparent 40%),
        var(--velvet);
    }

    .hero::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--crimson), var(--gold), var(--crimson));
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      background: rgba(212,175,55,0.1);
      border: 1px solid var(--gold);
      border-radius: 30px;
      font-size: 0.85rem;
      color: var(--gold);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 30px;
      animation: fadeInDown 0.8s ease 1.5s both;
    }

    .hero-icons {
      font-size: 4rem;
      margin-bottom: 20px;
      animation: fadeInDown 0.8s ease 1.6s both;
      filter: drop-shadow(0 0 30px rgba(212,175,55,0.5));
    }

    .hero h1 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2.5rem, 6vw, 4.5rem);
      font-weight: 900;
      background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 50%, var(--gold-dark) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 20px;
      animation: fadeInDown 0.8s ease 1.7s both;
      text-shadow: 0 0 60px rgba(212,175,55,0.3);
    }

    .hero-tagline {
      font-size: 1.4rem;
      font-weight: 300;
      color: rgba(250,248,245,0.8);
      margin-bottom: 50px;
      animation: fadeInDown 0.8s ease 1.8s both;
    }
    .hero-tagline em {
      font-style: normal;
      color: var(--gold);
      font-weight: 500;
    }

    .hero-buttons {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      justify-content: center;
      animation: fadeInUp 0.8s ease 1.9s both;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 16px 32px;
      font-size: 1rem;
      font-weight: 500;
      text-decoration: none;
      border-radius: 4px;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .btn-gold {
      background: linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%);
      color: var(--velvet);
      box-shadow: 0 4px 20px rgba(212,175,55,0.4);
    }
    .btn-gold:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 30px rgba(212,175,55,0.6);
    }

    .btn-outline {
      background: transparent;
      color: var(--cream);
      border: 1px solid rgba(250,248,245,0.3);
    }
    .btn-outline:hover {
      border-color: var(--gold);
      color: var(--gold);
      transform: translateY(-3px);
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Demo Section - Ticket Style */
    .demo {
      padding: 100px 20px;
      background: linear-gradient(180deg, var(--velvet) 0%, var(--velvet-light) 100%);
      position: relative;
    }

    .demo::before {
      content: 'PREVIEW';
      position: absolute;
      top: 40px;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Playfair Display', serif;
      font-size: 0.9rem;
      letter-spacing: 8px;
      color: var(--gold);
      opacity: 0.5;
    }

    .ticket {
      max-width: 700px;
      margin: 0 auto;
      background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
      position: relative;
    }

    .ticket::before, .ticket::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 30px;
      height: 30px;
      background: var(--velvet-light);
      border-radius: 50%;
      transform: translateY(-50%);
    }
    .ticket::before { left: -15px; }
    .ticket::after { right: -15px; }

    .ticket-header {
      background: linear-gradient(135deg, var(--crimson) 0%, var(--crimson-light) 100%);
      padding: 20px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ticket-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.2rem;
      font-weight: 700;
    }

    .ticket-badge {
      background: var(--gold);
      color: var(--velvet);
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .ticket-body {
      padding: 30px;
    }

    .chat-user {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }

    .chat-avatar {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      flex-shrink: 0;
    }

    .chat-bubble {
      background: rgba(212,175,55,0.1);
      border: 1px solid rgba(212,175,55,0.3);
      padding: 14px 20px;
      border-radius: 4px 16px 16px 16px;
      font-size: 0.95rem;
    }

    .chat-response {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 24px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      line-height: 2;
      margin-left: 48px;
    }

    .chat-response .rank { color: var(--gold); }
    .chat-response .title { color: var(--cream); font-weight: 500; }
    .chat-response .count { color: rgba(250,248,245,0.6); }

    /* Tools Section */
    .tools {
      padding: 120px 20px;
      background: var(--velvet);
      position: relative;
    }

    .tools::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, var(--gold) 50%, transparent 100%);
      opacity: 0.3;
    }

    .section-header {
      text-align: center;
      margin-bottom: 80px;
    }

    .section-label {
      font-size: 0.85rem;
      letter-spacing: 4px;
      color: var(--gold);
      text-transform: uppercase;
      margin-bottom: 15px;
    }

    .section-title {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 700;
      color: var(--cream);
    }

    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .tool-card {
      background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
      padding: 32px;
      transition: all 0.4s ease;
      position: relative;
      overflow: hidden;
    }

    .tool-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--crimson), var(--gold));
      opacity: 0;
      transition: opacity 0.4s ease;
    }

    .tool-card:hover {
      transform: translateY(-8px);
      border-color: rgba(212,175,55,0.3);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }

    .tool-card:hover::before { opacity: 1; }

    .tool-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, var(--crimson) 0%, var(--crimson-light) 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      margin-bottom: 20px;
      box-shadow: 0 8px 20px rgba(139,0,0,0.3);
    }

    .tool-card h3 {
      font-family: 'Playfair Display', serif;
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 8px;
      color: var(--cream);
    }

    .tool-code {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: var(--gold);
      background: rgba(212,175,55,0.1);
      padding: 6px 12px;
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .tool-card p {
      color: rgba(250,248,245,0.6);
      font-size: 0.95rem;
    }

    /* CTA Section */
    .cta {
      padding: 120px 20px;
      text-align: center;
      background:
        radial-gradient(ellipse at 50% 100%, rgba(139,0,0,0.2) 0%, transparent 50%),
        linear-gradient(180deg, var(--velvet-light) 0%, var(--velvet) 100%);
      position: relative;
    }

    .cta-title {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 700;
      margin-bottom: 20px;
      color: var(--cream);
    }

    .cta-desc {
      font-size: 1.1rem;
      color: rgba(250,248,245,0.7);
      margin-bottom: 40px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }

    .cta-buttons {
      display: flex;
      gap: 20px;
      justify-content: center;
      flex-wrap: wrap;
    }

    /* Footer */
    footer {
      background: #0a0505;
      padding: 60px 20px;
      text-align: center;
      border-top: 1px solid rgba(212,175,55,0.1);
    }

    .footer-logo {
      font-family: 'Playfair Display', serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--gold);
      margin-bottom: 20px;
    }

    .endpoint-box {
      display: inline-block;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      padding: 16px 32px;
      border-radius: 8px;
      margin: 20px 0;
    }

    .endpoint-label {
      font-size: 0.75rem;
      color: var(--gold);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .endpoint-url {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      color: var(--cream);
    }

    .footer-links {
      margin-top: 30px;
      display: flex;
      gap: 30px;
      justify-content: center;
    }

    .footer-links a {
      color: rgba(250,248,245,0.5);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.3s ease;
    }

    .footer-links a:hover { color: var(--gold); }

    .footer-copy {
      margin-top: 30px;
      color: rgba(250,248,245,0.3);
      font-size: 0.8rem;
    }

    /* Container */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .film-strip { display: none; }
      .hero { padding: 80px 20px; }
      .hero-icons { font-size: 3rem; }
      .tools-grid { grid-template-columns: 1fr; }
      .ticket { margin: 0 10px; }
      .chat-response { margin-left: 0; margin-top: 15px; }
    }
  </style>
</head>
<body>
  <div class="curtain-left"></div>
  <div class="curtain-right"></div>
  <div class="film-strip left"></div>
  <div class="film-strip right"></div>

  <section class="hero">
    <span class="hero-badge">MCP Server for Korean Culture</span>
    <div class="hero-icons">🎬 🎭 🎪</div>
    <h1>Korea Culture MCP</h1>
    <p class="hero-tagline"><em>"오늘 뭐 볼까?"</em> 라고 물으면 바로 답해드립니다</p>
    <div class="hero-buttons">
      <a href="https://playmcp.kakao.com" class="btn btn-gold" target="_blank">PlayMCP에서 추가</a>
      <a href="https://github.com/yonghwan1106/korea-culture-mcp" class="btn btn-outline" target="_blank">GitHub</a>
    </div>
  </section>

  <section class="demo">
    <div class="ticket">
      <div class="ticket-header">
        <span class="ticket-title">실시간 데모</span>
        <span class="ticket-badge">LIVE</span>
      </div>
      <div class="ticket-body">
        <div class="chat-user">
          <div class="chat-avatar">👤</div>
          <div class="chat-bubble">오늘 영화 박스오피스 순위 알려줘</div>
        </div>
        <div class="chat-response">
          <span class="rank">🎬</span> 일별 박스오피스<br><br>
          <span class="rank">🥇</span> <span class="title">하얼빈</span> <span class="count">- 누적 5,234,567명</span><br>
          <span class="rank">🥈</span> <span class="title">위키드</span> <span class="count">- 누적 3,456,789명</span><br>
          <span class="rank">🥉</span> <span class="title">소방관</span> <span class="count">- 누적 2,345,678명</span>
        </div>
      </div>
    </div>
  </section>

  <section class="tools">
    <div class="container">
      <div class="section-header">
        <p class="section-label">Tools</p>
        <h2 class="section-title">6개 도구로 문화생활 완벽 커버</h2>
      </div>
      <div class="tools-grid">
        <div class="tool-card">
          <div class="tool-icon">🎬</div>
          <h3>영화 박스오피스</h3>
          <span class="tool-code">culture_get_box_office</span>
          <p>일별/주간 박스오피스 순위와 관객수를 실시간으로 조회합니다</p>
        </div>
        <div class="tool-card">
          <div class="tool-icon">🎥</div>
          <h3>영화 상세정보</h3>
          <span class="tool-code">culture_get_movie_detail</span>
          <p>감독, 배우, 관람등급, 상영시간 등 영화 상세정보를 제공합니다</p>
        </div>
        <div class="tool-card">
          <div class="tool-icon">🎭</div>
          <h3>공연 검색</h3>
          <span class="tool-code">culture_search_performance</span>
          <p>연극, 뮤지컬, 콘서트 등 장르별 공연을 검색합니다</p>
        </div>
        <div class="tool-card">
          <div class="tool-icon">🎪</div>
          <h3>공연 상세정보</h3>
          <span class="tool-code">culture_get_performance_detail</span>
          <p>출연진, 티켓가격, 공연시간 등 상세정보를 확인합니다</p>
        </div>
        <div class="tool-card">
          <div class="tool-icon">🏛️</div>
          <h3>공연장 정보</h3>
          <span class="tool-code">culture_get_facility_info</span>
          <p>공연장 위치, 좌석수, 연락처 등을 조회합니다</p>
        </div>
        <div class="tool-card">
          <div class="tool-icon">✨</div>
          <h3>오늘의 추천</h3>
          <span class="tool-code">culture_get_recommendations</span>
          <p>인기 영화와 공연을 한 번에 추천받을 수 있습니다</p>
        </div>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="container">
      <h2 class="cta-title">지금 바로 시작하세요</h2>
      <p class="cta-desc">PlayMCP에서 도구함에 추가하거나 Claude Desktop에 연결하여 사용할 수 있습니다</p>
      <div class="cta-buttons">
        <a href="https://playmcp.kakao.com" class="btn btn-gold" target="_blank">PlayMCP에서 추가</a>
        <a href="https://github.com/yonghwan1106/korea-culture-mcp" class="btn btn-outline" target="_blank">GitHub 저장소</a>
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      <div class="footer-logo">🎬 Korea Culture MCP</div>
      <p>영화/공연 정보, AI에게 물어보세요</p>
      <div class="endpoint-box">
        <p class="endpoint-label">MCP Endpoint</p>
        <p class="endpoint-url">https://korea-culture-mcp-eight.vercel.app/mcp</p>
      </div>
      <div class="footer-links">
        <a href="https://github.com/yonghwan1106/korea-culture-mcp" target="_blank">GitHub</a>
        <a href="https://playmcp.kakao.com" target="_blank">PlayMCP</a>
      </div>
      <p class="footer-copy">MIT License · KOBIS & KOPIS API Powered</p>
    </div>
  </footer>

  <script>
    // Remove curtains after animation
    setTimeout(() => {
      document.querySelectorAll('.curtain-left, .curtain-right').forEach(el => el.remove());
    }, 2000);

    // Spotlight effect
    const spotlight = document.createElement('div');
    spotlight.className = 'spotlight';
    document.body.appendChild(spotlight);

    document.addEventListener('mousemove', (e) => {
      spotlight.style.left = e.clientX - 150 + 'px';
      spotlight.style.top = e.clientY - 150 + 'px';
    });
  </script>
</body>
</html>`;

// ===== Vercel 핸들러 =====

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, x-session-id, Accept");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 경로 확인
  const urlPath = req.url?.split("?")[0] || "/";

  // 랜딩 페이지 (루트 경로)
  if (req.method === "GET" && (urlPath === "/" || urlPath === "")) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(LANDING_PAGE_HTML);
  }

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      tools: TOOLS.map((t) => t.name),
    });
  }

  // MCP JSON-RPC endpoint
  if (req.method === "POST") {
    try {
      const body = req.body;
      const { jsonrpc, id, method, params } = body;

      if (jsonrpc !== "2.0") {
        return res.status(400).json(jsonRpcError(id, -32600, "Invalid JSON-RPC version"));
      }

      let result: any;

      switch (method) {
        case "initialize":
          result = {
            protocolVersion: params?.protocolVersion || "2024-11-05",
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: SERVER_INFO,
          };
          break;

        case "notifications/initialized":
          return res.status(200).json(jsonRpcResponse(id, {}));

        case "tools/list":
          result = { tools: TOOLS };
          break;

        case "tools/call": {
          const toolName = params?.name;
          const toolArgs: ToolArguments = params?.arguments || {};

          let toolResult: string;

          switch (toolName) {
            case "culture_get_box_office":
              toolResult = await cultureGetBoxOffice(toolArgs);
              break;
            case "culture_get_movie_detail":
              toolResult = await cultureGetMovieDetail(toolArgs);
              break;
            case "culture_search_performance":
              toolResult = await cultureSearchPerformance(toolArgs);
              break;
            case "culture_get_performance_detail":
              toolResult = await cultureGetPerformanceDetail(toolArgs as { performance_id: string; response_format?: string });
              break;
            case "culture_get_facility_info":
              toolResult = await cultureGetFacilityInfo(toolArgs);
              break;
            case "culture_get_recommendations":
              toolResult = await cultureGetRecommendations(toolArgs);
              break;
            case "culture_search_festival":
              toolResult = await cultureSearchFestival(toolArgs);
              break;
            case "culture_search_tourist_spot":
              toolResult = await cultureSearchTouristSpot(toolArgs);
              break;
            case "culture_search_restaurant":
              toolResult = await cultureSearchRestaurant(toolArgs);
              break;
            default:
              return res.status(400).json(jsonRpcError(id, -32601, `Unknown tool: ${toolName}`));
          }

          result = {
            content: [{ type: "text", text: toolResult }],
          };
          break;
        }

        case "ping":
          result = {};
          break;

        default:
          return res.status(400).json(jsonRpcError(id, -32601, `Unknown method: ${method}`));
      }

      return res.status(200).json(jsonRpcResponse(id, result));
    } catch (error) {
      console.error("MCP Handler Error:", error);
      return res.status(500).json(jsonRpcError(null, -32603, getErrorMessage(error)));
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
