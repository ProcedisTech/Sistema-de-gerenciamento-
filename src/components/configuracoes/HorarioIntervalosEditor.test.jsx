import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HorarioIntervalosEditor } from "./HorarioIntervalosEditor";
function Editor({ initial = [] }) {
  const [value, setValue] = useState(initial);
  return <HorarioIntervalosEditor value={value} onChange={setValue} />;
}
afterEach(cleanup);
it("adiciona os sete dias em sequência e respeita três turnos por dia", () => {
  render(<Editor />);
  for (let index = 0; index < 21; index++) {
    fireEvent.click(screen.getByRole("button", { name: "Adicionar turno" }));
    expect(
      screen.getAllByRole("combobox").map((input) => Number(input.value)),
    ).toEqual(
      Array.from({ length: index + 1 }, (_, i) => [1, 2, 3, 4, 5, 6, 0][i % 7]),
    );
  }
  expect(
    screen.getByRole("button", { name: "Limite de horários atingido" }),
  ).toBeDisabled();
  expect(screen.getAllByRole("combobox")).toHaveLength(21);
});
it("preenche dias ausentes e permite recuperar capacidade ao remover um turno", () => {
  render(
    <Editor
      initial={[1, 2, 3, 4, 5].map((day) => ({
        diaSemana: day,
        horaInicio: "08:00",
        horaFim: "18:00",
      }))}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Adicionar turno" }));
  expect(screen.getByLabelText("Dia do intervalo 6")).toHaveValue("6");
  fireEvent.click(screen.getByRole("button", { name: "Adicionar turno" }));
  expect(screen.getByLabelText("Dia do intervalo 7")).toHaveValue("0");
  fireEvent.click(screen.getAllByTitle("Remover intervalo")[1]);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar turno" }));
  expect(screen.getByLabelText("Dia do intervalo 7")).toHaveValue("2");
});
it("não permite trocar um intervalo para dia com três turnos", () => {
  render(
    <Editor
      initial={[1, 1, 1, 2].map((day) => ({
        diaSemana: day,
        horaInicio: "08:00",
        horaFim: "12:00",
      }))}
    />,
  );
  expect(
    screen
      .getByLabelText("Dia do intervalo 4")
      .querySelector('option[value="1"]'),
  ).toBeDisabled();
});
