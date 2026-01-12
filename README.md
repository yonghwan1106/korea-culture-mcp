# Korea Culture MCP

영화 박스오피스, 공연/전시 정보를 AI로 조회하는 MCP 서버

## 기능

- **culture_get_box_office**: 일별/주간 영화 박스오피스 조회
- **culture_get_movie_detail**: 영화 상세정보 조회
- **culture_search_performance**: 공연 검색 (연극, 뮤지컬, 콘서트 등)
- **culture_get_performance_detail**: 공연 상세정보 조회
- **culture_get_facility_info**: 공연장 정보 조회
- **culture_get_recommendations**: 오늘의 추천 (영화+공연 통합)

## 사용된 API

- **KOBIS** (영화진흥위원회): 박스오피스, 영화정보
- **KOPIS** (공연예술통합전산망): 공연, 공연장 정보

## 배포

Vercel을 통해 배포됩니다.

### 환경 변수

```
KOBIS_API_KEY=your_kobis_api_key
KOPIS_API_KEY=your_kopis_api_key
```

## MCP Endpoint

```
https://korea-culture-mcp.vercel.app/mcp
```

## 대화 예시

- "오늘 영화 박스오피스 순위 알려줘"
- "이번 주말 서울 뮤지컬 공연 뭐 있어?"
- "예술의전당 정보 알려줘"

## License

MIT
