# TODO: Collapsible Subtopics in Subject Topics

## ✅ Step 1: CSS - Add collapsible topic styles
- Add `.topic-header` cursor:pointer styles
- Add `.chevron` rotation for expanded state
- Add `.topic-body` max-height transition (collapsed/expanded)

## ✅ Step 2: JS - Modify `renderTopic()` 
- Add chevron icon next to topic name
- Wrap subtopics + add-subtopic-row in `.topic-body` div
- Track expanded state using `Set`

## ✅ Step 3: JS - Wire toggle events in `wireTopicEvents()`
- Add click handler on topic header to toggle expanded
- Stop propagation on delete-topic button

## Step 4: Test
- [ ] Verify expand/collapse works
- [ ] Verify all existing interactions still work

