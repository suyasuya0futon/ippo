// 今日画面は、共通の TaskListView を mode="today" で表示するだけ。
import TaskListView from "./TaskListView";

export default function TodayScreen() {
  return <TaskListView mode="today" />;
}
