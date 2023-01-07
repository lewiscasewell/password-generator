import Head from "next/head";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, { useCallback, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { pbkdf2Sync } from "pbkdf2";
import {
  CopyIcon,
  Cross1Icon,
  DotsHorizontalIcon,
  DotsVerticalIcon,
  InfoCircledIcon,
  PlusCircledIcon,
} from "@radix-ui/react-icons";

import { WORD_LIST } from "../utils/words";
import { useFieldArray, useForm } from "react-hook-form";

import * as Toast from "@radix-ui/react-toast";
import { z } from "zod";

import { motion } from "framer-motion";
import { useFollowPointer } from "../utils/use-follow-pointer";
import classNames from "classnames";
import { useRouter } from "next/router";

export function Circle() {
  const ref = useRef(null);
  const { x, y } = useFollowPointer(ref);

  return (
    <motion.div
      ref={ref}
      className="z-0 w-[200px] absolute h-[200px] rounded-full bg-rose-500 "
      animate={{ x, y }}
      transition={{
        type: "spring",
        damping: 20,
        stiffness: 100,
        restDelta: 0.001,
      }}
    />
  );
}

const passwordSchema = z.object({
  site: z.string(),
  username: z.string(),
  password: z.string(),
  visible: z.boolean(),
});

const schema = z.object({
  seed: z.string().min(30, {
    message: "Seed phrase is required to be at least 30 characters long",
  }),
  domains: z.string().array().optional(),
  passwords: z.array(passwordSchema).optional(),
});

const ToastDemo = () => {
  const [open, setOpen] = React.useState(false);

  return (
    <Toast.Provider swipeDirection="right">
      <button
        className="Button large violet"
        onClick={() => {
          setOpen(false);
        }}
      >
        Add to calendar
      </button>

      <Toast.Root className="bg-red-400 p-4" open={open} onOpenChange={setOpen}>
        <Toast.Title className="ToastTitle">Scheduled: Catch up</Toast.Title>
        <Toast.Description asChild>
          <p className="text-white bg-red-500">hello</p>
        </Toast.Description>
        <Toast.Action
          className="ToastAction"
          asChild
          altText="Goto schedule to undo"
        >
          <button className="Button small green">Undo</button>
        </Toast.Action>
      </Toast.Root>
      <Toast.Viewport className="fixed p-7 bottom-0 right-0 flex flex-col gap-2 w-[300px] m-0 z-50 outline-none" />
    </Toast.Provider>
  );
};

function generateSeedPhrase(words: string[], length: number) {
  // Make a copy of the words array
  const remainingWords = [...words];
  const seedPhrase: string[] = [];

  // Generate a random index for the array
  // and use the word at that index as the next word in the seed phrase
  while (seedPhrase.length < length) {
    const randomIndex = Math.floor(Math.random() * remainingWords.length);
    const randomWord = remainingWords[randomIndex];
    seedPhrase.push(randomWord);
    remainingWords.splice(randomIndex, 1);
  }

  return seedPhrase.join(" ");
}

function generatePassword(seed: string, salt: string, length: number) {
  // Characters to include in the password
  const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
  const symbols = "!@#$%^&*";
  const numbers = "0123456789";

  // Combine the character sets and convert to an array
  const charSet = uppercaseChars + lowercaseChars + symbols + numbers;
  const charArray = charSet.split("");

  // Generate the salt
  // const salt = Math.random().toString(36).slice(2);

  // Generate the password hash using PBKDF2
  const passwordHash = pbkdf2Sync(seed, salt, 1000, length, "sha256");

  // Convert the password hash to a string of characters
  let password = "";
  for (let i = 0; i < passwordHash.length; i++) {
    const charIndex = passwordHash[i] % charArray.length;
    password += charArray[charIndex];
  }

  return password;
}

type PasswordItemType = z.infer<typeof passwordSchema>;

const columnHelper = createColumnHelper<PasswordItemType>();

const columns = [
  columnHelper.accessor("site", {
    cell: (info) => (
      <div className="max-w-[100px]">
        <input className="bg-transparent w-full" value={info.cell.getValue()} />
      </div>
    ),
    id: "domain",
    header: () => (
      <div className="max-w-[100px]">
        <span>Domain</span>
      </div>
    ),
  }),
  columnHelper.accessor("password", {
    header: () => (
      <div className="">
        <p>Password</p>
      </div>
    ),
    id: "Password",
    cell: (info) => (
      <div
        onClick={() => {
          navigator.clipboard.writeText(info.cell.getValue());
        }}
        className="flex flex-1 items-center space-x-3"
      >
        <input
          className="bg-transparent w-full"
          disabled
          value={info.cell.getValue()}
        />
        <button>
          <CopyIcon />
        </button>
      </div>
    ),
  }),
];

export default function Home() {
  const rerender = React.useReducer(() => ({}), {})[1];
  const [passwordLength, setPasswordLength] = useState(16);
  const [warningVisible, setWarningVisible] = useState(true);
  const [domain, setDomain] = useState("");
  const router = useRouter();
  const defaults: z.infer<typeof schema> = {
    seed: "",
    domains: [],
    passwords: [],
  };

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const fieldArray = useFieldArray({
    name: "passwords",
    control: methods.control,
  });

  const table = useReactTable({
    data: fieldArray.fields,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const DOMAINS = methods.getValues("domains");

  const removeDomainInputItemByIndex = useCallback(
    (indexToRemove: number) => {
      const currentData = methods.getValues("domains");

      const dataWithout = currentData?.filter(
        (i, index) => index !== indexToRemove
      );

      methods.setValue("domains", dataWithout);
      rerender();
    },
    [rerender, methods]
  );

  const generateAllPasswords = async () => {
    if (domain === "" && DOMAINS?.length === 0) {
      methods.setError("domains", { message: "At least one domain required." });
    }

    setDomain("");

    await [...(methods.getValues("domains") ?? []), domain].forEach((i) => {
      if (i === "" || i.split(" ").length > 1) {
        return;
      }
      fieldArray.append({
        site: i,
        visible: false,
        username: "",
        password: generatePassword(methods.getValues("seed"), i, 32),
      });
    });
    methods.setValue("domains", []);
  };

  const clearData = () => {
    methods.reset();
    setDomain("");
  };

  const handleSubmit = () =>
    methods.handleSubmit(
      (data) => generateAllPasswords(),
      (error) => console.log("errors", error)
    );

  return (
    <>
      <Head>
        <title>Password generator</title>
        <meta name="description" content="Generate passwords" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="mx-auto h-full min-h-screen">
        <Circle />
        {warningVisible && (
          <div className="top-0 sticky space-y-2 w-full z-50">
            <div className="text-sm bg-yellow-600 p-2 text-zinc-200 border-[0.25px] border-yellow-200 flex items-start  ">
              <div className="max-w-4xl mx-auto flex space-x-2">
                <InfoCircledIcon className="text-yellow-100 h-5 w-5" />
                <p className="text-xs text-yellow-100">
                  Passwords are not stored anywhere. This application is
                  intended for generation of passwords only. Make sure to clear
                  data as soon as you can.
                </p>
                <button onClick={() => setWarningVisible(false)}>
                  <Cross1Icon className="text-yellow-100 h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="background z-50 sticky space-y-4 px-2 sm:px-4 md:px-5 h-full min-h-screen py-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between py-12 items-center">
              <div className="w-full sm:w-1/2 space-y-8">
                <div className="space-y-2 ">
                  <h1 className="text-7xl hover:text-white transition-colors ease-in text-transparent font-extrabold bg-clip-text bg-gradient-to-br from-white to-zinc-600">
                    Password Generator
                  </h1>
                  <p className="text-sm text-gray-400 ">
                    Enter a seedphrase and the domain of a website to generate
                    secure passwords.
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={clearData}
                    className="text-sm bg-zinc-50/80 hover:bg-zinc-50/90 transition-all ease-in py-2 px-4 font-bold rounded-md text-black hover:shadow-lg "
                  >
                    Clear data
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "As we don't store your information anywhere, visiting this link will clear any data you have entered. Are you sure you want to continue?"
                        )
                      ) {
                        router.push("/guide");
                      }
                    }}
                    className="text-sm font-bold py-2 px-4 bg-zinc-900/70 p-2 rounded-md text-zinc-200 border-[0.25px] border-zinc-600 hover:bg-zinc-900/90 hover:shadow-lg transition-colors ease-in"
                  >
                    How to guide
                  </button>
                </div>
              </div>

              <div className="z-0 rounded-full h-[200px] w-[200px] sm:flex items-center justify-center hidden">
                <div className="text-[160px]">🔐</div>
              </div>
            </div>
            <div className="h-10" />

            {/* <p>
            Some notes. Here goes a tab. Password. Haiku poem to remember the
            seed phrase using openai? or an acronym? What options? Maybe a
            select for different encryption methods, symbols?, length of
            characters? numbers? Have options to pick from as backups?
          </p> */}

            <div className="flex-col space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center h-10">
                  <label className="text-lg font-semibold">Seed phrase</label>
                  <button
                    onClick={() => {
                      const seedphrase = generateSeedPhrase(WORD_LIST, 10);

                      methods.setValue("seed", seedphrase);
                    }}
                    className="text-md bg-zinc-900/70 p-2 rounded-md text-zinc-200 border-[0.25px] border-zinc-600 hover:bg-zinc-900/90 transition-colors ease-in"
                  >
                    Generate
                  </button>
                </div>
                <textarea
                  {...methods.register("seed")}
                  className="bg-zinc-900/70 p-4 rounded-lg w-full border-[0.25px] border-zinc-600 shadow-sm focus:outline-rose-600"
                  placeholder="e.g. cat play fence"
                />

                {methods.formState.errors.seed && (
                  <p className="text-red-400">
                    * {methods.getFieldState("seed").error?.message}
                  </p>
                )}
              </div>

              <fieldset className="space-y-3 py-4">
                <label className="font-semibold text-lg" htmlFor="name">
                  Bulk add domain names
                </label>
                <div className="flex flex-wrap gap-2 bg-zinc-900/70 p-2 rounded-lg w-full border-[0.25px] border-zinc-600 shadow-sm ">
                  {DOMAINS?.map((i, idx) => {
                    if (i === "") {
                      return null;
                    }
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          removeDomainInputItemByIndex(idx);
                        }}
                        className="text-md flex items-center space-x-2 bg-zinc-900/70 p-2 rounded-md text-zinc-200 border-[0.25px] border-zinc-600 hover:bg-zinc-900 transition-colors ease-in"
                      >
                        <p>{i}</p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            removeDomainInputItemByIndex(idx);
                          }}
                        >
                          <Cross1Icon />
                        </button>
                      </div>
                    );
                  })}
                  <input
                    value={domain.split(" ").length > 1 ? "" : domain}
                    onKeyDown={(e) => {
                      const prev = methods?.getValues("domains") ?? [];
                      if (e.key === " " || e.code === "Space") {
                        e.preventDefault();

                        methods.setValue("domains", [
                          ...prev,
                          ...domain.split(" "),
                        ]);
                        setDomain("");
                      }
                      if (domain === "" && e.key === "Backspace") {
                        removeDomainInputItemByIndex(prev.length - 1);
                      }
                      if (e.key === "Enter") {
                        handleSubmit()();
                      }
                    }}
                    onChange={(e) => {
                      const prev = methods.getValues("domains") ?? [];
                      if (e.target.value.split(" ").length > 1) {
                        const newData = [
                          ...prev,
                          ...e.target.value.toUpperCase().split(" "),
                        ];

                        methods.setValue("domains", newData);
                        setDomain("");
                        rerender();
                      } else {
                        setDomain(e.target.value.toUpperCase());
                      }
                    }}
                    className="bg-transparent p-2 rounded-lg outline-none flex-1"
                    placeholder={
                      methods.getValues("domains")?.length === 0
                        ? "e.g. VERCEL GITHUB TWITTER"
                        : "..."
                    }
                  />
                </div>
                {methods.formState.errors.domains && (
                  <p className="text-red-400">
                    * {methods.getFieldState("domains").error?.message}
                  </p>
                )}
                <div className="py-2">
                  <button
                    onClick={() => handleSubmit()()}
                    className="text-white bg-rose-900 p-2 rounded-md font-bold hover:bg-rose-700 hover:shadow-lg transition-colors ease-in"
                  >
                    Generate passwords
                  </button>
                </div>
              </fieldset>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between h-10 items-center">
                <h2 className="text-lg font-semibold">Passwords</h2>

                <button className="p-2 bg-zinc-900/70 rounded-md border-[0.25px] border-zinc-600">
                  <DotsHorizontalIcon />
                </button>
              </div>
              <div className="w-full bg-zinc-900/70 py-4 rounded-lg border-[0.25px] border-zinc-600 shadow-sm">
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className={`text-left font-semibold px-4 pb-2 border-b-[0.25px] border-zinc-600 ${
                              header.id === "domain" ? "" : ""
                            }`}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="">
                        {row.getVisibleCells().length === 0 && (
                          <div className="text-white h-20">Empty</div>
                        )}
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="p-4 border-[0.25px] border-zinc-600"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {/* <tfoot>
                <div className="max-w-[100px] flex justify-between items-center">
                  <input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value.toUpperCase())}
                    placeholder="New domain"
                    className="p-4 bg-transparent"
                  />
                  <div
                    className="ml-4"
                    onClick={() => {
                      handleSubmit()();
                    }}
                  >
                    <PlusCircledIcon className="w-6 h-6" />
                  </div>
                </div>
              </tfoot> */}
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
