# The .pb File Format

The data concerning one instance of participatory budgeting is to be stored in a single UTF-8 text file with the extension `.pb`. The content of the file is to be divided into three sections:

- **META** section with general metadata like the country, budget, number of votes.
- **PROJECTS** section with projects costs and possibly some other metadata regarding projects like category, target etc.
- **VOTES** section with votes, that can be in one of the four types: approval, ordinal, cumulative, scoring; and optionally with metadata regarding voters like age, sex etc.

Each section starts with a title line (one of `META`, `PROJECTS`, `VOTES`), followed by a column header line which is a semicolon-separated list of the names of the columns used in the section (for the META section this must be `key;value`, for the other sections it depends on which information is available), followed by several lines encoding the data.

## A Simple Example

```
META
key; value
description; Municipal PB in Wieliczka
country; Poland
unit; Wieliczka
instance; 2020
num_projects; 5
num_votes; 10
budget; 2500
rule: greedy
vote_type; approval
min_length; 1
max_length; 3
date_begin; 16.09.2023
date_end; 04.10.2023
PROJECTS
project_id; cost; category
1; 600; culture, education
2; 800; sport
4; 1400; culture
5; 1000; health, sport
7; 1200; education
VOTES
voter_id; age; sex; vote
1; 34; f; 1,2,4
2; 51; m; 1,2
3; 23; m; 2,4,5
4; 19; f; 5,7
5; 62; f; 1,4,7
6; 54; m; 1,7
7; 49; m; 5
8; 27; f; 4
9; 39; f; 2,4,5
10; 44; m; 4,5
```

## Format Conventions

Although this is not a single standard CSV file, the format behaves similarly. Each `.pb` file consists of three sections (meta, projects, and votes), each structured like a separate CSV table — with different numbers of columns per section. Because of this structure, the format follows standard CSV conventions, meaning that special characters are properly escaped using double quotes.

Values are separated by a semicolon (`;`). If a field contains a semicolon, it is enclosed in double quotes (`"`). Double quotes inside a field are escaped by doubling them (`""`). Fields that do not contain special characters (like `;` or `"`) are left unquoted.

For example, in the `poland_wroclaw_2017_.pb` file:

```
18; 1000000; 8640; Rowerowy Wrocław 2017; category
50; 1000000; 10796; "Zielona rowerowo-piesza obwodnica Wrocławia; ETAP II"; category
499; 1000000; 3949; """Konikowo"" - Budowa autorskiego placu zabaw"; category
```

---

# Detailed Description

**Note:** Fields marked with ⚠️ are mandatory/required.

## Section 1: META

All fields are provided as **key:value** pairs.

### Mandatory Fields ⚠️

- **description** ⚠️ (str) – a brief summary of the process.
  - Example: `Municipal PB in Wieliczka`

- **country** ⚠️ (str) – name of the country. If the election was held across multiple countries we use `Worldwide` term.
  - Example: `Poland`

- **unit** ⚠️ (str) – name of the municipality, region, organization, etc., holding the PB process.
  - Example: `Wieliczka`

- **instance** ⚠️ (str) – a unique identifier of the specific edition of the PB process (year, edition number, etc.) used by the organizers to identify that edition; note that `instance` will not necessarily correspond to the year in which the vote is actually held, as some organizers identify the edition by the fiscal year in which the PB projects are to be carried out.
  - Example: `2023`

- **num_projects** ⚠️ (int) – the total number of projects involved, which must match the count from the PROJECTS section.
  - Example: `42`

- **num_votes** ⚠️ (int) – the total number of votes, which must match the count from the VOTES section.
  - Example: `1000`

- **budget** ⚠️ (float or int) – the total amount of funds to be allocated.
  - Example: `500000.00` or `20000`

- **vote_type** ⚠️ (str) – the voting mechanism employed. Options:
  - `approval` – each vote is a subset of projects
  - `ordinal` – each vote is a permutation of a subset of projects such that its size is in [min_length, max_length], corresponding to a strict preference ordering
  - `cumulative` – each vote is a vector **v** ∈ ℝ⁺^|P| such that ‖**v**‖₁ ≤ max_sum_points ∈ ℝ₊; we usually omit the projects that have zero support
  - `scoring` – each vote is a vector **v** ∈ I^|P|, where I ⊆ ℝ
  - `choose-1` – participants are allowed to cast a single vote for one project

- **rule** ⚠️ (str) – the rule applied to the voting results. Options:
  - `greedy`
  - `equalshares`
  - `equalshares/add1`
  - `unknown` – either the information is not available, or there were multiple possibilities, and it is unclear which one applies

- **date_begin** ⚠️ (str) – the starting date of voting, `dd.mm.yyyy` format. If the exact date is unavailable, providing just the year is sufficient.
  - Example: `16.09.2023` or `2023`

- **date_end** ⚠️ (str) – the ending date of voting, `dd.mm.yyyy` format. If the exact date is unavailable, providing just the year is sufficient.
  - Example: `04.10.2023` or `2023`

### Optional Fields (if vote_type == approval)

- **min_length** (default: 1)
- **max_length** (default: num_projects)
- **min_sum_cost** (default: 0)
- **max_sum_cost** (default: ∞)

### Optional Fields (if vote_type == ordinal)

- **min_length** (default: 1)
- **max_length** (default: num_projects)
- **scoring_fn** (default: Borda)

### Optional Fields (if vote_type == cumulative)

- **min_length** (default: 1)
- **max_length** (default: num_projects)
- **min_points** (default: 0)
- **max_points** (default: max_sum_points)
- **min_sum_points** (default: 0)
- **max_sum_points** ⚠️ (required for cumulative voting)

### Optional Fields (if vote_type == scoring)

- **min_length** (default: 1)
- **max_length** (default: num_projects)
- **min_points** (default: -∞)
- **max_points** (default: ∞)
- **default_score** (default: 0)

### Other Optional Fields

- **subunit** (str) – name of the sub-jurisdiction or category within which the preferences are aggregated and funds are allocated. Additionally, subunit (if exists) is added to the file name on the website: 'country_unit_instance_subunit', so it's more 'official'.
  - Example: `Sunnydale Village`
  - Scenarios:
    - In Paris, there are 21 PBs – a city-wide budget and 20 district-wide budgets. For the city-wide budget, `unit` is Paris, and `subunit` is undefined, while for the district-wide budgets, `unit` is also Paris, and `subunit` is the name of the district (e.g., `IIIe arrondissement`).
    - Before 2019, in Warsaw there were district-wide and neighborhood-wide PBs. For all of them, `unit` is Warsaw, while `subunit` is the name of the district for district-wide budgets, and the name of the neighborhood for neighborhood-wide budgets. To associate neighborhoods with districts (if desired), an additional property `district` can be used.
    - In a given city, there may be distinct PBs for each of n > 1 categories (environmental projects, transportation projects, etc.). For all of them, `unit` is the city name, while `subunit` is the name of the category.

- **district** (str) – see descriptions of `subunit` above.
  - Example: `Brooklyn`

- **edition** (str) – typically a sequential number indicating an event in the series.
  - Example: `6`

- **language** (str) – language of the description texts (i.e., full project names), in ISO 639 format (assigned as two-letter code).
  - Example: `en`

- **currency** (str) – budget's currency, in ISO 4217 format (assigned as three-letter code).
  - Example: `EUR` or `PLN`

- **fully_funded** (int*) – a flag indicating whether the budget was greater than the total cost of all projects, which already meant funding all the projects before the voting. Added only to files where such a situation occurred; we do not add `fully_funded;0`. There is an excluder for such instances on the website.
  - Example: `1`

- **experimental** (int*) – a flag indicating whether the data is artificial. Excluder on the website.
  - Example: `1`

- **comment** (str) – a comment (or comments) for the file. It can address various issues such as data inconsistencies, errors in voting, or mistakes in vote counting. Sometimes there is more than one comment, and they may repeat. For this reason, each comment gets a sequential number (#1:, #2:, #3:, etc.).
  - Example: `#1: Project 586 was free (cost 0). To keep data consistent and not to have 0-cost projects (may cause problems when processing data) we set its cost to an artificial value of 1. #2: If a given project has multiple coordinates, then the average over these coordinates is taken.`

- **acknowledgments** (str) – used to cite the sources of data, methodologies, or tools referenced or utilized in the file.
  - Example: `Data from Yang et al. (2024), https://arxiv.org/abs/2310.03501.`

- **min_project_score_threshold** (int) – a minimum score a project must receive to be eligible for implementation. Even if a project fits within the available budget, it will not be selected unless it meets this threshold. In the case of approval ballots, the score is simply the number of votes received.
  - Example: `300`

- **Other non-standard fields:**
  - `min_project_cost`
  - `max_project_cost`
  - `neighborhoods`
  - `subdistricts`
  - `categories`
  - `leftover_budget`
  - `budget_per_category`
  - `budget_per_neighborhood`
  - `min_length_per_category`
  - `max_length_per_category`
  - `min_sum_cost_per_category`
  - `max_sum_cost_per_category`

---

## Section 2: PROJECTS

### Mandatory Fields ⚠️

- **project_id** ⚠️ (str) – unique identifier for the project.
  - Example: `124-A`

- **cost** ⚠️ (int or float) – the cost of the project.
  - Example: `50000`

### Optional Fields

- **votes** (int) – represents the total number of unique voting actions for a project, incrementing by one for each voter regardless of the points given. For example, if a voter gives 5 points to a project, it adds 1 to the votes and 5 to the score.
  - Example: `560`

- **score** (int) – reflects the cumulative sum of points awarded to the project, increasing by the exact number of points assigned by voters. For example, if a voter gives 5 points to a project, it adds 1 to the votes and 5 to the score.
  - Example: `1430`

- **name** (str) – full project name.
  - Example: `Community Park Renovation`

- **category** (list) – categories assigned to the project, separated by commas
  - Scenarios:
    - A project might be classified under 'environmental protection' if it aims to improve recycling facilities in a community.
    - A 'public space' project could involve renovating a local park to include more seating areas and playground equipment.
  - Example: `urban greenery,public space,environmental protection`

- **target** (list) – target group, beneficiaries for whom the project is intended. Separated by commas.
  - Scenarios:
    - A project targeted at 'youth' might include building a new skateboard park.
    - 'Seniors' might be the target for a project that introduces fitness programs tailored to older adults in community centers.
  - Example: `people with disabilities,seniors`

- **selected** (int*) – if project was selected by original rule. Typically selected (1) or not (0), but there are ambiguous cases where 2 is used. Then, explained in the comment.
  - Example: `0` or `1` or `2`

- **district** (str) – identifies the district within a city where the project is located or applicable. This field is particularly useful in city-wide instances.
  - Example: `Manhattan`

- **neighborhood** (str) – similar to `district` but different granularity.
  - Example: `Upper West Side`

- **description** (str) – more details about a project.
  - Example: `The Community Green Space Enhancement Project aims to transform underutilized urban spaces into vibrant, eco-friendly areas for public use.`

- **proposer** (str) – a full name of the individual or group proposing a project.
  - Example: `Jane Doe`

- **latitude** (float) – coordinates. If a given project has multiple coordinates, then the average over these coordinates is taken.
  - Example: `52.1314771874616`

- **longitude** (float) – coordinates. If a given project has multiple coordinates, then the average over these coordinates is taken.
  - Example: `21.0567927351804`

- **Other non-standard fields:**
  - `sustainability` – indicating whether a project adheres to environmental sustainability principles
  - `community_involvement` – detailing the extent of local community participation in the project's planning and execution
  - `public_id`

---

## Section 3: VOTES

### Mandatory Fields ⚠️

- **voter_id** ⚠️ (str) – unique identifier for the voter.
  - Example: `P5424`

- **vote** ⚠️ (conditional, format depends on vote_type):
  - If `vote_type == approval`: list of ids of the approved projects, separated by commas
  - If `vote_type == ordinal`: list of ids of the selected projects, from the most preferred one to the least preferred one, separated by commas
  - If `vote_type == cumulative`: list of project ids, in decreasing order induced by points, separated by commas; projects not listed are assumed to be awarded 0 points
  - If `vote_type == scoring`: list of project ids, in decreasing order induced by points, separated by commas; projects not listed are assumed to be awarded `default_score` points

### Conditionally Mandatory ⚠️

- **points** ⚠️ (conditional, list) – required if `vote_type == cumulative` or `vote_type == scoring`
  - Points assigned to the selected projects, listed in the same order as project ids in `vote`

### Optional Fields

- **age** (int) – age of the voter. Sometimes it shows very low values (starting from zero), indicating that one doesn't need to be an adult to vote. If a voter is under 13, they can vote with the consent of a parent or guardian. Hence, for example, age 0 likely corresponds to cases where parents/guardians are voting on behalf of their children.
  - Example: `27`

- **sex** (str) – currently, only two values are present.
  - Example: `M` or `F`

- **voting_method** (str) – online or offline?
  - Example: `internet` or `paper`

- **district** (str) – voter's district; particularly useful in city-wide instances.
  - Example: `Krowodrza`

- **neighborhood** (str) – similar to `district` but different granularity.
  - Example: `Krowodrza Górka`

- **education** (str) – voter's education level.
  - Example: `Master's degree`

- **Other non-standard fields:**
  - `topic_preference_transport`
  - `topic_preference_culture`
  - `topic_preference_nature`
  - `district_preference`
  - `time_taken_seconds`
  - `format_easiness`
  - `format_expressiveness`
  - `format_rank`

---

## Important Note

We use integers instead of booleans for flag values (such as 1 and 0) as this approach provides more flexibility. For example, a project can be either selected (1) or not (0). But there are cases where a project is selected for another reason, such as an error made by the company conducting the voting process. In such cases, we can assign a special value, like 2, and explain it in a comment.
