import type { BriefInput, CompetitorInput } from "./actions";

export const EMPTY_BRIEF: BriefInput = {
  product_id: null,
  execution_date: null,
  project_name: "",
  project_type: null,
  product_category: null,
  justification: "",
  sources_description: "",
  sensorial: {},
  target: {},
  channels: [],
  channels_other: "",
  margin_pct: null,
  suggested_price_by_presentation: [
    { presentation: "400 mL", price: null },
    { presentation: "200 mL", price: null },
  ],
  legal_requirements: "",
  implementation_costs: "",
  recommendations: "",
};

export const EMPTY_COMPETITORS: CompetitorInput[] = [{ manufacturer: "", product_name: "" }];
